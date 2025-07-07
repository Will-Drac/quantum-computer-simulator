class GateMatrix {
    constructor(unitary, numQbits, controls, qbitApplied) { //controls is [[qbit, "pos" or "neg"], ...] where the last will be at qbit0
        this.unitary = unitary

        // creating an entries object for the single gate matrix, or two if there is more than one value per row
        this.entries = []

        // if there is only one non-zero value per row, we collapse it to be represented in one buffer, but the convention that column 0 will be in the first buffer and column 1 in the second is no longer possible, so we have to write down which column in the original matrix each row links to (it will only be one, because only one non-zero)
        this.val0Col = undefined
        this.val1Col = undefined

        this.numQbits = numQbits
        this.controls = controls
        this.qbitApplied = qbitApplied
    }


    async create() {
        if (this.unitary.modified.has2ColPerRow) {
            // for the first column:
            this.entries.push(device.createBuffer({
                size: 4 * 2,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
                mappedAtCreation: true
            }))
            const entries0Val0 = 0 << 31 | 0 << 30 | 0 //not 1 | row 0 in original matrix (and column 0 implied because it's entries[0]) | column 0
            const entries0Val1 = 0 << 31 | 1 << 30 | 0 //not 1 | row 1 in original matrix (and column 0 implied because it's entries[0]) | column 0
            new Uint32Array(this.entries[0].getMappedRange()).set(new Uint32Array([entries0Val0, entries0Val1]))
            this.entries[0].unmap()

            // for the second column:
            this.entries.push(device.createBuffer({
                size: 4 * 2,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
                mappedAtCreation: true
            }))
            const entries1Val0 = 0 << 31 | 0 << 30 | 1 //not 1 | row 0 in original matrix (and column 1 implied because it's entries[1]) | column 1
            const entries1Val1 = 0 << 31 | 1 << 30 | 1 //not 1 | row 1 in original matrix (and column 1 implied because it's entries[1]) | column 1
            new Uint32Array(this.entries[1].getMappedRange()).set(new Uint32Array([entries1Val0, entries1Val1]))
            this.entries[1].unmap()
        }
        else {
            // now we can condense the matrix into one column, but we need to keep track of how that was done
            this.entries.push(device.createBuffer({
                size: 4 * 2,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
                mappedAtCreation: true
            }))

            let entriesVal0 = 0
            let entriesVal1 = 0

            if (this.unitary.modified.real[0][0] == 0 && this.unitary.modified.imag[0][0] == 0) { //this entry will represent [0][1]
                entriesVal0 = 0 << 31 | 0 << 30 | 1 //not 1 | row 0 in original matrix (column 1 not implied but written down) | column 1
                this.val0Col = 1
            }
            else { //this entry will represent [0][0]
                entriesVal0 = 0 << 31 | 0 << 30 | 0 //not 1 | row 0 in original matrix (column 0 not implied but written down) | column 0
                this.val0Col = 0
            }

            if (this.unitary.modified.real[1][0] == 0 && this.unitary.modified.imag[1][0] == 0) { //this entry will represent [1][1]
                entriesVal1 = 0 << 31 | 1 << 30 | 1 //not 1 | row 1 in original matrix (column 1 not implied but written down) | column 1
                this.val1Col = 1
            }
            else { //this entry will represent [1][0]
                entriesVal1 = 0 << 31 | 1 << 30 | 0 //not 1 | row 1 in original matrix (column 0 not implied but written down) | column 0
                this.val1Col = 0
            }

            new Uint32Array(this.entries[0].getMappedRange()).set(new Uint32Array([entriesVal0, entriesVal1]))
            this.entries[0].unmap()
        }

        // the first `this.controls.length` qbits are reserved for controls, for now. they will get switched later
        const freeQbits = this.numQbits - this.controls.length
        let newAppliedIndex = this.qbitApplied - this.controls.length

        let temporaryAppliedQbit = null
        if (newAppliedIndex < 0) { //the qbit to apply to has been reserved for a control
            newAppliedIndex = 0
            temporaryAppliedQbit = 0
        }

        // how many I2 matrices get applied before and after the gate does
        const IBeforeGate = freeQbits - newAppliedIndex - 1
        const IAfterGate = newAppliedIndex

        // apply all the I matrices before and after the gate
        if (IBeforeGate > 0) {
            for (let i = 0; i < this.entries.length; i++) {
                this.entries[i] = await this.kroneckerI(2 ** IBeforeGate, "right", this.entries[i])
            }
        }
        if (IAfterGate > 0) {
            for (let i = 0; i < this.entries.length; i++) {
                this.entries[i] = await this.kroneckerI(2 ** IAfterGate, "left", this.entries[i]) //size doubles with each I
            }
        }

        // now add the controls
        for (let i = 0; i < this.controls.length; i++) {
            for (let j = 0; j < this.entries.length; j++) {
                this.entries[j] = await this.addControl(this.controls[i][1], this.entries[j], j == 0)
            }
        }

        // finally, since the controls get added as the first qbits by default, we have to swap the qbits indices in the matrix so that the controls are in the right place
        for (let j = 0; j < this.entries.length; j++) {
            for (let i = this.controls.length - 1; i >= 0; i--) {
                this.entries[j] = await this.swapQbits(i, this.controls[i][0], this.entries[j])
                if (this.controls[i][0] == temporaryAppliedQbit) { temporaryAppliedQbit = i } //keep track of where the temporary applied qbit goes, it might get swapped
            }

            // now put the applied qbit back where it should be
            this.entries[j] = await this.swapQbits(this.qbitApplied, temporaryAppliedQbit, this.entries[j])
        }

    }


    // only does kronecker on one "matrix" (with one column per row)
    async kroneckerI(ISize, ISide, entries) { //the size of the I matrix (1, I2, I4, etc) and whether I is on the "left" or "right"
        const oldSize = entries.size / 4
        const newSize = oldSize * ISize
        const workgroupsPerDimension = Math.ceil(Math.sqrt(newSize))

        const kiModule = device.createShaderModule({
            code: (await loadWGSL(ISide == "left" ? "./shaders/kroneckerILeft.wgsl" : "./shaders/kroneckerIRight.wgsl"))
                .replace("_ISIZE", ISize)
                .replace("_OLDSIZE", oldSize)
                .replace("_WORKGROUPSPERDIM", workgroupsPerDimension)
        })

        const kiPipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
                module: kiModule
            }
        })

        const newEntries = device.createBuffer({
            size: 4 * newSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        })

        const kiBindGroup = device.createBindGroup({
            layout: kiPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: entries } },
                { binding: 1, resource: { buffer: newEntries } }
            ]
        })

        const kiEncoder = device.createCommandEncoder()
        const kiPass = kiEncoder.beginComputePass()
        kiPass.setPipeline(kiPipeline)
        kiPass.setBindGroup(0, kiBindGroup)
        kiPass.dispatchWorkgroups(workgroupsPerDimension, workgroupsPerDimension, 1) //in the shader we'll need to ignore the useless workgroups now
        kiPass.end()

        device.queue.submit([kiEncoder.finish()])

        return newEntries
    }

    async addControl(type, entries, isEntries0) { //type is "pos" or "neg"
        console.log(type, entries, isEntries0)
        const oldSize = entries.size / 4
        const newSize = oldSize * 2
        const workgroupsPerDimension = Math.ceil(Math.sqrt(newSize))

        const cModule = device.createShaderModule({
            code: (await loadWGSL(type == "pos" ? "shaders/addControl.wgsl" : "shaders/addNegativeControl.wgsl"))
                .replace("_SIZE", newSize)
                .replace("_WORKGROUPSPERDIM", workgroupsPerDimension)
                .replace("_ISENTRIES0", isEntries0)
        })

        const cPipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
                module: cModule
            }
        })

        const newEntries = device.createBuffer({
            size: 4 * newSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        })

        const cBindGroup = device.createBindGroup({
            layout: cPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: entries } },
                { binding: 1, resource: { buffer: newEntries } }
            ]
        })

        const cEncoder = device.createCommandEncoder()
        const cPass = cEncoder.beginComputePass()
        cPass.setPipeline(cPipeline)
        cPass.setBindGroup(0, cBindGroup)
        cPass.dispatchWorkgroups(workgroupsPerDimension, workgroupsPerDimension, 1)
        cPass.end()

        device.queue.submit([cEncoder.finish()])

        return newEntries
    }

    async swapQbits(qbit1, qbit2, entries) {
        if (qbit1 == qbit2 || qbit1==null || qbit2 == null) { return entries }

        console.log(qbit1, qbit2)

        const workgroupsPerDimension = Math.ceil(Math.sqrt(entries.size / 4))

        const sModule = device.createShaderModule({
            code: (await loadWGSL("/shaders/swap.wgsl"))
                .replace("_Q1", qbit1)
                .replace("_Q2", qbit2)
                .replace("_WORKGROUPSPERDIM", workgroupsPerDimension)
        })

        const sPipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
                module: sModule
            }
        })

        const newEntries = device.createBuffer({
            size: entries.size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        })

        const sBindGroup = device.createBindGroup({
            layout: sPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: entries } },
                { binding: 1, resource: { buffer: newEntries } }
            ]
        })

        const sEncoder = device.createCommandEncoder()
        const sPass = sEncoder.beginComputePass()
        sPass.setPipeline(sPipeline)
        sPass.setBindGroup(0, sBindGroup)
        sPass.dispatchWorkgroups(workgroupsPerDimension, workgroupsPerDimension, 1)
        sPass.end()

        device.queue.submit([sEncoder.finish()])

        return newEntries
    }
}