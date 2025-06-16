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

    async set(qbit, qbitState) { //sometimes this produces a different global phase from ibm composer but maybe that's ok
        const setModule = device.createShaderModule({
            label: "set qbit module",
            code: (await loadWGSL("./shaders/setQbit.wgsl")).replace("_QBIT", qbit).replace("_NEWSTATE", qbitState)
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

        // now all the impossible states have a state of 0, but we need to scale the remaining ones so that the probabilities add up to 1 again

        const probabilities = await removedState.getProbabilities() //!maybe its a bad idea to read all of these to the cpu for this

        let probabilitiesSum = 0
        for (let i = 0; i < probabilities.length; i++) {
            probabilitiesSum += probabilities[i]
        }

        const stateScaleFactor = Math.sqrt(1 / probabilitiesSum)

        removedState.vector = await removedState.vector.multiplyScalar(stateScaleFactor)

        return removedState
    }
}