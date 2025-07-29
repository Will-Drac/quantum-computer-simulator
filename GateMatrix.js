class GateMatrix {
    constructor(unitary, numQbits, controls) { //controls is ["pos" or "neg", ...] where the last will be at qbit0
        this.unitary = unitary

        // creating an entries object for the single gate matrix, or two if there is more than one value per row
        this.entries = []

        // if there is only one non-zero value per row, we collapse it to be represented in one buffer, but the convention that column 0 will be in the first buffer and column 1 in the second is no longer possible, so we have to write down which column in the original matrix each row links to (it will only be one, because only one non-zero)
        this.row0Col = undefined
        this.row1Col = undefined

        this.numQbits = numQbits
        this.controls = controls
    }


    async create() {
        // putting the 2x2 "modified" matrix into a buffer for the GPU
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

            if (equals0(this.unitary.modified.real[0][0]) && equals0(this.unitary.modified.imag[0][0])) { //this entry will represent [0][1]
                entriesVal0 = 0 << 31 | 0 << 30 | 1 //not 1 | row 0 in original matrix (column 1 not implied but written down) | column 1
                this.row0Col = 1
            }
            else { //this entry will represent [0][0]
                entriesVal0 = 0 << 31 | 0 << 30 | 0 //not 1 | row 0 in original matrix (column 0 not implied but written down) | column 0
                this.row0Col = 0
            }

            if (equals0(this.unitary.modified.real[1][0]) && equals0(this.unitary.modified.imag[1][0])) { //this entry will represent [1][1]
                entriesVal1 = 0 << 31 | 1 << 30 | 1 //not 1 | row 1 in original matrix (column 1 not implied but written down) | column 1
                this.row1Col = 1
            }
            else { //this entry will represent [1][0]
                entriesVal1 = 0 << 31 | 1 << 30 | 0 //not 1 | row 1 in original matrix (column 0 not implied but written down) | column 0
                this.row1Col = 0
            }

            new Uint32Array(this.entries[0].getMappedRange()).set(new Uint32Array([entriesVal0, entriesVal1]))
            this.entries[0].unmap()
        }

        // now creating the matrix to apply to the state
        // we're making a matrix where the controls are first (the last one applied is at qbit 0) and then the transformation is applied to the next smallest
        // before and after this gets applied to the state, the qbits will be swapped

        for (let j = 0; j < this.entries.length; j++) {
            for (let i = 0; i < this.controls.length; i++) {
                this.entries[j] = await this.addControl(this.controls[i], this.entries[j], j == 0)
            }
            this.entries[j] = await this.kroneckerI(2 ** (this.numQbits - this.controls.length - 1), "left", this.entries[j])
        }
    }


    // only does kronecker on one "matrix" (with one column per row)
    async kroneckerI(ISize, ISide, entries) { //the size of the I matrix (1, I2, I4, etc) and whether I is on the "left" or "right"
        const oldSize = entries.size / 4
        const newSize = oldSize * ISize
        const workgroupsPerDimension = Math.ceil(Math.sqrt(newSize))


        const newEntries = device.createBuffer({
            size: 4 * newSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        })

        runComputeShader(
            (await loadWGSL(ISide == "left" ? "./shaders/kroneckerILeft.wgsl" : "./shaders/kroneckerIRight.wgsl"))
                .replace("_ISIZE", ISize)
                .replace("_OLDSIZE", oldSize)
                .replace("_WORKGROUPSPERDIM", workgroupsPerDimension),

            [
                { binding: 0, resource: { buffer: entries } },
                { binding: 1, resource: { buffer: newEntries } }
            ],

            [workgroupsPerDimension, workgroupsPerDimension, 1]
        )

        return newEntries
    }

    async addControl(type, entries, isEntries0) { //type is "pos" or "neg"
        const oldSize = entries.size / 4
        const newSize = oldSize * 2
        const workgroupsPerDimension = Math.ceil(Math.sqrt(newSize))

        const newEntries = device.createBuffer({
            size: 4 * newSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        })

        runComputeShader(
            (await loadWGSL(type == "pos" ? "shaders/addControl.wgsl" : "shaders/addNegativeControl.wgsl"))
                .replace("_SIZE", newSize)
                .replace("_WORKGROUPSPERDIM", workgroupsPerDimension)
                .replace("_ISENTRIES0", isEntries0),

            [
                { binding: 0, resource: { buffer: entries } },
                { binding: 1, resource: { buffer: newEntries } }
            ],

            [workgroupsPerDimension, workgroupsPerDimension, 1]
        )

        return newEntries
    }
}