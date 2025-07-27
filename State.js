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

        const numRows = (2 ** this.numQbits) / 2 //removing half the probabilities

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
            size: this.probabilities.size / 2,
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

        return await sumBuffer(prunedBuffer)
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
            const X = new Unitary(pi, pi, 0)
            await X.apply(this, [], qbit)
        }
    }

    // extracts all useful information of a single qbit in this state: bloch sphere position, phase, probability, purity of reduced state
    async getQbitInfo(qbit) {
        const prob0 = await this.getQbitProbability0(qbit)

        // now, we need to get the coherence between |0> and |1>
        // to do that, we calculate all the needed elements of the state's full density matrix, put them into a buffer, and do a gpu reduction to add them all up

        const elementsWorkgroupsPerDimension = Math.ceil(Math.sqrt(2 ** (this.numQbits - 1)))

        let eModule = device.createShaderModule({
            code: (await loadWGSL("shaders/densityMatrixCoherenceElements.wgsl"))
                .replace("_SIZE", 2 ** (this.numQbits - 1))
                .replace("_WORKGROUPSPERDIM", elementsWorkgroupsPerDimension)
                .replace("_QBIT", qbit)
        })

        const ePipeline = device.createComputePipeline({
            layout: "auto",
            compute: { module: eModule }
        })

        const elementsBufferReal = device.createBuffer({
            size: 4 * 2 ** (this.numQbits - 1), //there will be half as many elements as entries in the state vector
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        })
        const elementsBufferImag = device.createBuffer({
            size: 4 * 2 ** (this.numQbits - 1), //there will be half as many elements as entries in the state vector
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        })

        const eBindGroup = device.createBindGroup({
            layout: ePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.vector.real } },
                { binding: 1, resource: { buffer: this.vector.imag } },
                { binding: 2, resource: { buffer: elementsBufferReal } },
                { binding: 3, resource: { buffer: elementsBufferImag } },
            ]
        })

        const eEncoder = device.createCommandEncoder()
        const ePass = eEncoder.beginComputePass()
        ePass.setPipeline(ePipeline)
        ePass.setBindGroup(0, eBindGroup)
        ePass.dispatchWorkgroups(elementsWorkgroupsPerDimension, elementsWorkgroupsPerDimension, 1)

        ePass.end()
        device.queue.submit([eEncoder.finish()])

        // now the elements buffer needs to be summed down to one number
        const coherence01 = { real: await sumBuffer(elementsBufferReal), imag: await sumBuffer(elementsBufferImag) }

        // finally, we can get the bloch sphere position
        const x = 2 * coherence01.real
        const y = -2 * coherence01.imag
        const z = 2 * prob0 - 1

        const radius = Math.sqrt(x ** 2 + y ** 2 + z ** 2)
        const phase = Math.atan2(y, x)

        const probabilityAngle = Math.atan2(Math.sqrt(x * x + y * y), z)

        return { position: { x, y, z }, radius, purity: 0.5 * (1 + radius ** 2), phase, probability0: prob0, probabilityAngle }
    }
}