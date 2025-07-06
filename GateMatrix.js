class GateMatrix {
    constructor(unitary, numQbits, controls, qbitApplied) { //controls is ["pos" or "neg"], ...] where the last will be at qbit0
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
        if (this.unitary.has2ColPerRow) {
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

            if (this.unitary.real[0][0] == 0 && this.unitary.imag[0][0] == 0) { //this entry will represent [0][1]
                entriesVal0 = 0 << 31 | 0 << 30 | 1 //not 1 | row 0 in original matrix (column 1 not implied but written down) | column 1
                this.val0Col = 1
            }
            else { //this entry will represent [0][0]
                entriesVal0 = 0 << 31 | 0 << 30 | 0 //not 1 | row 0 in original matrix (column 0 not implied but written down) | column 0
                this.val0Col = 0
            }

            if (this.unitary.real[1][0] == 0 && this.unitary.imag[1][0] == 0) { //this entry will represent [1][1]
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

        // how many I2 matrices get applied before and after the gate does
        const IBeforeGate = this.qbitApplied
        const IAfterGate = this.numQbits - this.qbitApplied - this.controls.length - 1

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
    }


    // only does kronecker on one "matrix" (with one column per row)
    async kroneckerI(ISize, ISide, entries) { //the size of the I matrix (1, I2, I4, etc) and whether I is on the "left" or "right"
        const oldSize = entries.size/4
        const newNumRows = oldSize * ISize
        const workgroupsPerDimension = Math.ceil(Math.sqrt(newNumRows))

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
            size: 4 * newNumRows,
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
}