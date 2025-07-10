class State {
    constructor(numQbits) {
        this.numQbits = numQbits
        this.vector = {}

        // the vector will start off as [1, 0, 0, ...]
        this.vector.real = device.createBuffer({
            size: 4 * 2 ** numQbits,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true
        })
        new Float32Array(this.vector.real.getMappedRange()).set(new Float32Array([1]))
        this.vector.real.unmap()

        this.vector.imag = device.createBuffer({
            size: 4 * 2 ** numQbits,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        })
    }

    async swap(qbitSwaps) { //qbitSwaps will hold a list of all swaps the make in order eg. [[0, 1], [0, 2]] 012 -> 201
        if (qbitSwaps.length == 0) { return }

        const size = this.vector.real.size
        const workgroupsPerDimension = Math.ceil(Math.sqrt(size))

        let swapCode = `const swaps: array<vec2u, ${qbitSwaps.length}> = array<vec2u, ${qbitSwaps.length}>(`
        for (let i = 0; i < qbitSwaps.length; i++) {
            swapCode += `vec2u(${qbitSwaps[i][0]}, ${qbitSwaps[i][1]}), `
        }
        swapCode += ");"

        const sModule = device.createShaderModule({
            code: (await loadWGSL("shaders/stateQbitSwap.wgsl"))
                .replace("_SIZE", size)
                .replace("_WORKGROUPSPERDIM", workgroupsPerDimension)
                .replace("_SWAPS", swapCode)
                .replaceAll("_NUMSWAPS", qbitSwaps.length)
        })

        const sPipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
                module: sModule
            }
        })

        const newReal = device.createBuffer({
            size: this.vector.real.size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        })
        const newImag = device.createBuffer({
            size: this.vector.imag.size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        })

        const sBindGroup = device.createBindGroup({
            layout: sPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.vector.real } },
                { binding: 1, resource: { buffer: this.vector.imag } },
                { binding: 2, resource: { buffer: newReal } },
                { binding: 3, resource: { buffer: newImag } },
            ]
        })

        const sEncoder = device.createCommandEncoder()
        const sPass = sEncoder.beginComputePass()
        sPass.setPipeline(sPipeline)
        sPass.setBindGroup(0, sBindGroup)
        sPass.dispatchWorkgroups(workgroupsPerDimension, workgroupsPerDimension, 1)
        sPass.end()

        device.queue.submit([sEncoder.finish()])

        this.vector.real = newReal
        this.vector.imag = newImag
    }
}