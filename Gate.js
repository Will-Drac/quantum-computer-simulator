class Gate {
    constructor(gateID, inputs) { //SWAP doesnt use the matrix unless it gets controlled. if it's a CUSTOM, inputs are not used
        this.gateID = gateID
        this.qbitsAffected = gateID == "CUSTOM" ? undefined : GateDefinitions[gateID].size

        if (gateID !== "CUSTOM") { //SWAP works with its own shader and CUSTOM will be done manually
            this.originalMatrix = new ComplexMatrix(2 ** this.qbitsAffected, 2 ** this.qbitsAffected)

            this.originalMatrix.hasReal = GateDefinitions[gateID].hasReal
            if (this.originalMatrix.hasReal) {
                if (typeof (GateDefinitions[gateID].real) == "function") {
                    this.originalMatrix.real.entries = GateDefinitions[gateID].real(inputs)
                }
                else {
                    this.originalMatrix.real.entries = GateDefinitions[gateID].real
                }
            }

            this.originalMatrix.hasImaginary = GateDefinitions[gateID].hasImaginary
            if (this.originalMatrix.hasImaginary) {
                if (typeof (GateDefinitions[gateID].imaginary) == "function") {
                    this.originalMatrix.imaginary.entries = GateDefinitions[gateID].imaginary(inputs)
                }
                else {
                    this.originalMatrix.imaginary.entries = GateDefinitions[gateID].imaginary
                }
            }

            this.originalMatrix.real.getTexture()
            this.originalMatrix.imaginary.getTexture()
        }
    }

    // the control always becomes the 0th qbit
    async addControl() {

        const newDimension = this.originalMatrix.rows * 2
        let newMatrix = new ComplexMatrix(newDimension, newDimension, undefined, undefined, this.originalMatrix.hasReal, this.originalMatrix.hasImaginary)

        if (newDimension <= 256) { //use the cpu for this

            let oldEntriesReal, oldEntriesImaginary
            if (this.originalMatrix.hasReal) {
                oldEntriesReal = await this.originalMatrix.real.getEntries()
            }
            if (this.originalMatrix.hasImaginary) {
                oldEntriesImaginary = await this.originalMatrix.imaginary.getEntries()
            }

            let newEntriesReal, newEntriesImaginary
            if (this.originalMatrix.hasReal) {
                newEntriesReal = Array.from({ length: newDimension }, () => Array(newDimension))
                for (let r = 0; r < newDimension; r++) {
                    for (let c = 0; c < newDimension; c++) {
                        if (c % 2 == 0) {
                            newEntriesReal[r][c] = r == c ? 1 : 0
                        }
                        else {
                            newEntriesReal[r][c] = r % 2 == 0 ? 0 : oldEntriesReal[(r - 1) / 2][(c - 1) / 2]
                        }
                    }
                }
            }
            if (this.originalMatrix.hasImaginary) {
                newEntriesImaginary = Array.from({ length: newDimension }, () => Array(newDimension))
                for (let r = 0; r < newDimension; c++) {
                    for (let c = 0; c < newDimension; c++) {
                        if (c % 2 == 0) {
                            newEntriesImaginary[r][c] = r == c ? 1 : 0
                        }
                        else {
                            newEntriesImaginary[r][c] = r % 2 == 0 ? 0 : oldEntriesImaginary[(r - 1) / 2][(c - 1) / 2]
                        }
                    }
                }
            }

            newMatrix.real.entries = newEntriesReal; newMatrix.imaginary.entries = newEntriesImaginary
            newMatrix.real.getTexture(); newMatrix.imaginary.getTexture()

            const newGate = new Gate("CUSTOM")
            newGate.originalMatrix = newMatrix
            newGate.qbitsAffected = Math.log2(newDimension)

            return newGate
        }
        else { //it's big enough that it will be worth using the gpu
            const cModule = device.createShaderModule({
                label: "add control module",
                code: await loadWGSL("./shaders/addControl.wgsl")
            })

            const cPipeline = device.createComputePipeline({
                label: "add control pipeline",
                layout: "auto",
                compute: {
                    module: cModule
                }
            })

            let newRealTexture, newImaginaryTexture
            if (this.originalMatrix.hasReal) {
                newRealTexture = device.createTexture({
                    dimension: "2d",
                    size: [newDimension, newDimension, 1],
                    format: "r32float",
                    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
                })

                const cBindGroup = device.createBindGroup({
                    label: "add control bind group real",
                    layout: cPipeline.getBindGroupLayout(0),
                    entries: [
                        { binding: 0, resource: this.originalMatrix.real.texture.createView() },
                        { binding: 1, resource: newRealTexture.createView() }
                    ]
                })

                const cEncoder = device.createCommandEncoder()
                const cPass = cEncoder.beginComputePass()
                cPass.setPipeline(cPipeline)
                cPass.setBindGroup(0, cBindGroup)
                cPass.dispatchWorkgroups(newDimension, newDimension, 1)
                cPass.end()

                device.queue.submit([cEncoder.finish()])
            }

            if (this.originalMatrix.hasImaginary) {
                newImaginaryTexture = device.createTexture({
                    dimension: "2d",
                    size: [newDimension, newDimension, 1],
                    format: "r32float",
                    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
                })

                const cBindGroup = device.createBindGroup({
                    label: "add control bind group real",
                    layout: cPipeline.getBindGroupLayout(0),
                    entries: [
                        { binding: 0, resource: this.originalMatrix.imaginary.texture.createView() },
                        { binding: 1, resource: newImaginaryTexture.createView() }
                    ]
                })

                const cEncoder = device.createCommandEncoder()
                const cPass = cEncoder.beginComputePass()
                cPass.setPipeline(cPipeline)
                cPass.setBindGroup(0, cBindGroup)
                cPass.dispatchWorkgroups(newDimension, newDimension, 1)
                cPass.end()

                device.queue.submit([cEncoder.finish()])
            }

            let newGate = new Gate("CUSTOM")
            newGate.originalMatrix = new ComplexMatrix(newDimension, newDimension, newRealTexture, newImaginaryTexture, this.originalMatrix.hasReal, this.originalMatrix.hasImaginary)
            newGate.qbitsAffected = Math.log2(newDimension)

            return newGate
        }

    }

    // the control always becomes the 0th qbit
    async addNegativeControl() {

        const newDimension = this.originalMatrix.rows * 2
        let newMatrix = new ComplexMatrix(newDimension, newDimension, undefined, undefined, this.originalMatrix.hasReal, this.originalMatrix.hasImaginary)

        if (newDimension <= 256) { //use the cpu for this

            let oldEntriesReal, oldEntriesImaginary
            if (this.originalMatrix.hasReal) {
                oldEntriesReal = await this.originalMatrix.real.getEntries()
            }
            if (this.originalMatrix.hasImaginary) {
                oldEntriesImaginary = await this.originalMatrix.imaginary.getEntries()
            }

            let newEntriesReal, newEntriesImaginary

            if (this.originalMatrix.hasReal) {
                newEntriesReal = Array.from({ length: newDimension }, () => Array(newDimension))
                for (let r = 0; r < newDimension; r++) {
                    for (let c = 0; c < newDimension; c++) {
                        if (c % 2 == 0) {
                            newEntriesReal[r][c] = r % 2 == 0 ? oldEntriesReal[r / 2][c / 2] : 0
                        }
                        else {
                            newEntriesReal[r][c] = r == c ? 1 : 0
                        }
                    }
                }
            }
            if (this.originalMatrix.hasImaginary) {
                newEntriesImaginary = Array.from({ length: newDimension }, () => Array(newDimension))
                for (let r = 0; r < newDimension; c++) {
                    for (let c = 0; c < newDimension; c++) {
                        if (c % 2 == 0) {
                            newEntriesImaginary[r][c] = r % 2 == 0 ? oldEntriesImaginary[r / 2][c / 2] : 0
                        }
                        else {
                            newEntriesImaginary[r][c] = r == c ? 1 : 0
                        }
                    }
                }
            }

            newMatrix.real.entries = newEntriesReal; newMatrix.imaginary.entries = newEntriesImaginary
            newMatrix.real.getTexture(); newMatrix.imaginary.getTexture()

            const newGate = new Gate("CUSTOM")
            newGate.originalMatrix = newMatrix
            newGate.qbitsAffected = Math.log2(newDimension)

            return newGate
        }
        else { //it's big enough that it will be worth using the gpu
            const cModule = device.createShaderModule({
                label: "add control module",
                code: await loadWGSL("./shaders/addNegativeControl.wgsl")
            })

            const cPipeline = device.createComputePipeline({
                label: "add control pipeline",
                layout: "auto",
                compute: {
                    module: cModule
                }
            })

            let newRealTexture, newImaginaryTexture
            if (this.originalMatrix.hasReal) {
                newRealTexture = device.createTexture({
                    dimension: "2d",
                    size: [newDimension, newDimension, 1],
                    format: "r32float",
                    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
                })

                const cBindGroup = device.createBindGroup({
                    label: "add control bind group real",
                    layout: cPipeline.getBindGroupLayout(0),
                    entries: [
                        { binding: 0, resource: this.originalMatrix.real.texture.createView() },
                        { binding: 1, resource: newRealTexture.createView() }
                    ]
                })

                const cEncoder = device.createCommandEncoder()
                const cPass = cEncoder.beginComputePass()
                cPass.setPipeline(cPipeline)
                cPass.setBindGroup(0, cBindGroup)
                cPass.dispatchWorkgroups(newDimension, newDimension, 1)
                cPass.end()

                device.queue.submit([cEncoder.finish()])
            }

            if (this.originalMatrix.hasImaginary) {
                newImaginaryTexture = device.createTexture({
                    dimension: "2d",
                    size: [newDimension, newDimension, 1],
                    format: "r32float",
                    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
                })

                const cBindGroup = device.createBindGroup({
                    label: "add control bind group real",
                    layout: cPipeline.getBindGroupLayout(0),
                    entries: [
                        { binding: 0, resource: this.originalMatrix.imaginary.texture.createView() },
                        { binding: 1, resource: newImaginaryTexture.createView() }
                    ]
                })

                const cEncoder = device.createCommandEncoder()
                const cPass = cEncoder.beginComputePass()
                cPass.setPipeline(cPipeline)
                cPass.setBindGroup(0, cBindGroup)
                cPass.dispatchWorkgroups(newDimension, newDimension, 1)
                cPass.end()

                device.queue.submit([cEncoder.finish()])
            }

            let newGate = new Gate("CUSTOM")
            newGate.originalMatrix = new ComplexMatrix(newDimension, newDimension, newRealTexture, newImaginaryTexture, this.originalMatrix.hasReal, this.originalMatrix.hasImaginary)
            newGate.qbitsAffected = Math.log2(newDimension)

            return newGate
        }

    }

    async getStateMatrix(numQbits, firstQbit) { // we are assuming all affected qbits are consecutive at this point
        const I = new IComplexMatrix(2)

        // initializing the state matrix as just the number 1
        this.stateMatrix = new ComplexMatrix(1, 1, undefined, undefined, true, false)
        this.stateMatrix.real.entries = [[1]]
        this.stateMatrix.real.getTexture()

        for (let i = numQbits - 1; i >= 0; i--) {
            if (i == firstQbit) {
                this.stateMatrix = await this.stateMatrix.kronecker(this.originalMatrix)
            }
            else if (!(i > firstQbit && i < firstQbit + this.qbitsAffected)) { //since the gate's matrix might span multiple qbits, dont kronecker I there because they are already covered
                this.stateMatrix = await this.stateMatrix.kronecker(I)
            }
        }

        return this.stateMatrix
    }

    async apply(state, qbits) { //by convention the first qbits are the control and the last are the target
        if (this.gateID == "SWAP") {
            return await state.swap(qbits[0], qbits[1])
        }

        let qbitSwaps = [] //keeping track of the swaps done so that they can be undone later

        // keeping the qbits in the array up do date with swaps happening
        function updateQbitsToSwap(swapped0, swapped1) {
            for (let i = 0; i < qbits.length; i++) {
                if (qbits[i] == swapped0) {
                    qbits[i] = swapped1
                }
                else if (qbits[i] == swapped1) {
                    qbits[i] = swapped0
                }
            }

            qbitSwaps.push([swapped0, swapped1])
        }

        // all qbits must lined up after the first, but if the first is too close to the end there won't be space, so it has to be moved to the top
        if (qbits[0] > state.numQbits - this.qbitsAffected) {
            state = await state.swap(qbits[0], 0)
            updateQbitsToSwap(qbits[0], 0)
        }


        for (let i = 1; i < qbits.length; i++) {
            // lining up the qbits in the correct order consecutive to each other
            state = await state.swap(qbits[i - 1] + 1, qbits[i])
            updateQbitsToSwap(qbits[i - 1] + 1, qbits[i])
        }

        await this.getStateMatrix(state.numQbits, qbits[0])
        const newStateVector = await this.stateMatrix.multiplyComplexVector(state.vector)
        let newState = new State(state.numQbits, newStateVector)

        // going through the swaps backwards to undo them
        for (let i = qbitSwaps.length - 1; i >= 0; i--) {
            newState = await newState.swap(qbitSwaps[i][0], qbitSwaps[i][1])
        }

        return newState
    }
}