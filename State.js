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

    async getProbabilities() {
        const size = this.vector.real.size
        const workgroupsPerDimension = Math.ceil(Math.sqrt(size))

        const pModule = device.createShaderModule({
            code: (await loadWGSL("shaders/stateProbabilities.wgsl"))
                .replace("_SIZE", size)
                .replace("_WORKGROUPSPERDIM", workgroupsPerDimension)
        })

        const pPipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
                module: pModule
            }
        })

        this.probabilities = device.createBuffer({
            size: this.vector.real.size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        })

        const pBindGroup = device.createBindGroup({
            layout: pPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.vector.real } },
                { binding: 1, resource: { buffer: this.vector.imag } },
                { binding: 2, resource: { buffer: this.probabilities } },
            ]
        })

        const pEncoder = device.createCommandEncoder()
        const pPass = pEncoder.beginComputePass()
        pPass.setPipeline(pPipeline)
        pPass.setBindGroup(0, pBindGroup)
        pPass.dispatchWorkgroups(workgroupsPerDimension, workgroupsPerDimension, 1)
        pPass.end()

        device.queue.submit([pEncoder.finish()])
    }

    // probability1 = 1-probability0
    async getQbitProbability0(qbit) {
        await this.getProbabilities()

        const numRows = 2 ** this.numQbits

        // first, we remove all the probabilities of the states where the qbit isn't 0
        // then, we add up all the remaining probabilities using gpu reduction

        const pruneWorkgroupsPerDimension = Math.ceil(Math.sqrt(numRows))

        const pModule = device.createShaderModule({
            code: (await loadWGSL("shaders/pruneProbabilities.wgsl"))
                .replace("_SIZE", numRows)
                .replace("_WORKGROUPSPERDIM", pruneWorkgroupsPerDimension)
                .replace("_QBIT", qbit)
        })

        const pPipeline = device.createComputePipeline({
            layout: "auto",
            compute: { module: pModule }
        })

        const prunedBuffer = device.createBuffer({
            size: this.probabilities.size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        })

        const pBindGroup = device.createBindGroup({
            layout: pPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.probabilities } },
                { binding: 1, resource: { buffer: prunedBuffer } }
            ]
        })

        const pEncoder = device.createCommandEncoder()
        const pPass = pEncoder.beginComputePass()
        pPass.setPipeline(pPipeline)
        pPass.setBindGroup(0, pBindGroup)
        pPass.dispatchWorkgroups(pruneWorkgroupsPerDimension, pruneWorkgroupsPerDimension, 1)

        pPass.end()
        device.queue.submit([pEncoder.finish()])

        // now doing the reduction

        const rModule = device.createShaderModule({
            code: await loadWGSL("shaders/reduceQbitProb.wgsl")
        })

        const rPipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
                module: rModule
            }
        })

        const workBuffer = device.createBuffer({
            size: prunedBuffer.size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        })

        const copyEncoder = device.createCommandEncoder()
        copyEncoder.copyBufferToBuffer(
            prunedBuffer, 0, workBuffer, 0, workBuffer.size
        )
        device.queue.submit([copyEncoder.finish()])

        const rUniformBuffer = device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        })

        const rBindGroup = device.createBindGroup({
            layout: rPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: workBuffer } },
                { binding: 1, resource: { buffer: rUniformBuffer } }
            ]
        })

        const numSteps = Math.ceil(Math.log2(numRows))
        for (let i = 0; i < numSteps; i++) {
            const thisReduceEncoder = device.createCommandEncoder()
            const thisPass = thisReduceEncoder.beginComputePass()

            const stride = 2 ** i// a stride of 1 means no entries are skipped and each pair is added, so it takes rows/2 workgroups. if stride is 2, every second entry is ignored and it takes rows/4 workgroups
            const workgroupsPerDimension = Math.ceil(Math.sqrt(numRows / (2 * stride)))

            const rUniforms = new Uint32Array(2)
            rUniforms.set([stride, workgroupsPerDimension])

            device.queue.writeBuffer(rUniformBuffer, 0, rUniforms)

            thisPass.setPipeline(rPipeline)
            thisPass.setBindGroup(0, rBindGroup)
            thisPass.dispatchWorkgroups(workgroupsPerDimension, workgroupsPerDimension, 1)

            thisPass.end()

            device.queue.submit([thisReduceEncoder.finish()])
        }

        // now workBuffer has the probability of the selected qbit in its first entry
        const readBuffer = device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        })

        const readEncoder = device.createCommandEncoder()
        readEncoder.copyBufferToBuffer(
            workBuffer, 0, readBuffer, 0, 4
        )
        device.queue.submit([readEncoder.finish()])

        await readBuffer.mapAsync(GPUMapMode.READ)

        return (new Float32Array(readBuffer.getMappedRange()))[0]
    }

    // measures a qbit to 0 or 1 and collapses part of the state
    async measure(qbit) {
        const probabilityToMeasure0 = await this.getQbitProbability0(qbit)
        const measurementResult = Math.random() < probabilityToMeasure0 ? 0 : 1

        // now to collapse
        const numRows = 2 ** this.numQbits
        const workgroupsPerDimension = Math.ceil(Math.sqrt(numRows))

        const cModule = device.createShaderModule({
            code: (await loadWGSL("shaders/collapseState.wgsl"))
                .replace("_SIZE", numRows)
                .replace("_WORKGROUPSPERDIM", workgroupsPerDimension)
                .replace("_QBIT", qbit)
                .replace("_MEASUREMENT", measurementResult)
                .replace("_MEASUREMENTPROB", measurementResult == 0 ? probabilityToMeasure0 : 1 - probabilityToMeasure0)
        })

        const cPipeline = device.createComputePipeline({
            layout: "auto",
            compute: { module: cModule }
        })

        const cBindGroup = device.createBindGroup({
            layout: cPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.vector.real } },
                { binding: 1, resource: { buffer: this.vector.imag } }
            ]
        })

        const cEncoder = device.createCommandEncoder()
        const cPass = cEncoder.beginComputePass()

        cPass.setPipeline(cPipeline)
        cPass.setBindGroup(0, cBindGroup)
        cPass.dispatchWorkgroups(workgroupsPerDimension, workgroupsPerDimension, 1)

        cPass.end()
        device.queue.submit([cEncoder.finish()])

        return measurementResult
    }

    async reset(qbit) {
        const measurementResult = await this.measure(qbit)

        // if it was measured to be 1, flip the qbit to be 0
        if (measurementResult == 1) {
            const X = new Unitary(Math.PI, Math.PI, 0)
            await X.apply(this, [], qbit)
        }
    }
}