class State {
    constructor(numQbits, vector) {
        this.numQbits = numQbits

        if (vector) {
            this.vector = vector
        }
        else {
            this.vector = new ComplexVector(2 ** numQbits, undefined, undefined, true, false)
            this.vector.real.getEntries()
            this.vector.real.entries[0] = 1
            this.vector.real.getTexture()
        }

    }

    async getProbabilities() {
        await this.vector.calculateModSquare()
        return await this.vector.getModSquare()
    }

    // swaps the position of two qbits in the state, essentially reorders the entries in this state's vectors
    async swap(qbit1, qbit2) {
        if (qbit1 == qbit2) { return this } //do nothing

        const swapModule = device.createShaderModule({
            label: "swap qbits module",
            code: (await loadWGSL("./shaders/swap.wgsl")).replace("_Q1", qbit1).replace("_Q2", qbit2)
        })

        const swapPipeline = device.createComputePipeline({
            label: "swap qbits pipeline",
            layout: "auto",
            compute: {
                module: swapModule
            }
        })

        const newRealTexture = device.createTexture({
            dimension: "2d",
            size: [2 ** this.numQbits, 1, 1],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })

        const newImaginaryTexture = device.createTexture({
            dimension: "2d",
            size: [2 ** this.numQbits, 1, 1],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })


        // the real part first
        if (this.vector.hasReal) {
            const swapBindGroupReal = device.createBindGroup({
                label: "swap qbits bind group real",
                layout: swapPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: this.vector.real.texture.createView() },
                    { binding: 1, resource: newRealTexture.createView() }
                ]
            })

            const swapEncoderReal = device.createCommandEncoder()
            const swapPassReal = swapEncoderReal.beginComputePass()
            swapPassReal.setPipeline(swapPipeline)
            swapPassReal.setBindGroup(0, swapBindGroupReal)
            swapPassReal.dispatchWorkgroups(2 ** this.numQbits, 1, 1)
            swapPassReal.end()

            device.queue.submit([swapEncoderReal.finish()])
        }


        // then the imaginary part
        if (this.vector.hasImaginary) {
            const swapBindGroupImaginary = device.createBindGroup({
                label: "swap qbits bind group imaginary",
                layout: swapPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: this.vector.imaginary.texture.createView() },
                    { binding: 1, resource: newImaginaryTexture.createView() }
                ]
            })

            const swapEncoderImaginary = device.createCommandEncoder()
            const swapPassImaginary = swapEncoderImaginary.beginComputePass()
            swapPassImaginary.setPipeline(swapPipeline)
            swapPassImaginary.setBindGroup(0, swapBindGroupImaginary)
            swapPassImaginary.dispatchWorkgroups(2 ** this.numQbits, 1, 1)
            swapPassImaginary.end()

            device.queue.submit([swapEncoderImaginary.finish()])
        }

        return new State(this.numQbits, new ComplexVector(2 ** this.numQbits, newRealTexture, newImaginaryTexture, this.vector.hasReal, this.vector.hasImaginary))
    }

    async measure(qbit) {
        const probabilities = await this.getProbabilities()

        function bitEquals(x, bitIndex, value) {
            return ((x >> bitIndex) & 1) === (value & 1)
        }

        let probabilityOf0 = 0 //probabilityOf1 is just 1-probabilityOf0
        for (let i = 0; i < probabilities.length; i++) {
            if (bitEquals(i, qbit, 0)) {
                probabilityOf0 += probabilities[i]
            }
        }

        const bitMeasured = Math.random() < probabilityOf0 ? 0 : 1

        // now remove all impossible states from the state vector: states where the qbit measured doesnt have the value that we measured for it

        const setModule = device.createShaderModule({
            label: "set qbit module",
            code: (await loadWGSL("./shaders/setQbit.wgsl")).replace("_QBIT", qbit).replace("_NEWSTATE", bitMeasured)
        })

        const setPipeline = device.createComputePipeline({
            label: "set qbit pipeline",
            layout: "auto",
            compute: {
                module: setModule
            }
        })

        const newRealTexture = device.createTexture({
            dimension: "2d",
            size: [2 ** this.numQbits, 1, 1],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })

        const newImaginaryTexture = device.createTexture({
            dimension: "2d",
            size: [2 ** this.numQbits, 1, 1],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })

        // the real part first
        if (this.vector.hasReal) {
            const setBindGroupReal = device.createBindGroup({
                label: "swap qbits bind group real",
                layout: setPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: this.vector.real.texture.createView() },
                    { binding: 1, resource: newRealTexture.createView() }
                ]
            })

            const setEncoderReal = device.createCommandEncoder()
            const setPassReal = setEncoderReal.beginComputePass()
            setPassReal.setPipeline(setPipeline)
            setPassReal.setBindGroup(0, setBindGroupReal)
            setPassReal.dispatchWorkgroups(2 ** this.numQbits, 1, 1)
            setPassReal.end()

            device.queue.submit([setEncoderReal.finish()])
        }


        // then the imaginary part
        if (this.vector.hasImaginary) {
            const setBindGroupImaginary = device.createBindGroup({
                label: "swap qbits bind group imaginary",
                layout: setPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: this.vector.imaginary.texture.createView() },
                    { binding: 1, resource: newImaginaryTexture.createView() }
                ]
            })

            const setEncoderImaginary = device.createCommandEncoder()
            const setPassImaginary = setEncoderImaginary.beginComputePass()
            setPassImaginary.setPipeline(setPipeline)
            setPassImaginary.setBindGroup(0, setBindGroupImaginary)
            setPassImaginary.dispatchWorkgroups(2 ** this.numQbits, 1, 1)
            setPassImaginary.end()

            device.queue.submit([setEncoderImaginary.finish()])
        }

        const removedState = new State(this.numQbits, new ComplexVector(2 ** this.numQbits, newRealTexture, newImaginaryTexture, this.vector.hasReal, this.vector.hasImaginary))

        // now the probability won't add up to 100%, we need to scale up the remaining probabilities

        let probabilityLeft = bitMeasured == 0 ? probabilityOf0 : 1 - probabilityOf0

        removedState.vector = await removedState.vector.multiplyScalar(Math.sqrt(1 / probabilityLeft))

        return { state: removedState, measurement: bitMeasured }
    }

    async reset(qbit) {
        // measure that qbit to get it out of superposition
        const measureResult = await this.measure(qbit)
        let newState = measureResult.state

        // if the measurement happens to be 1, flip it to 0
        if (measureResult.measurement == 1) {
            newState = await (new Gate("X")).apply(newState, [qbit])
        }

        return newState
    }
}