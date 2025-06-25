class Gate {
    constructor(gateID, inputs) { //SWAP doesnt use the matrix unless it gets controlled. if it's a CUSTOM, inputs are not used
        const isSpecialGate = gateID == "CUSTOM" || gateID == "GPHASE"

        this.gateID = gateID
        this.qbitsAffected = isSpecialGate ? undefined : GateDefinitions[gateID].size
        this.controls = isSpecialGate ? [] : GateDefinitions[gateID].controls
        this.inputs = inputs

        if (!isSpecialGate) { //SWAP and GPHASE work with their own shaders and CUSTOM will be done manually
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

    async inverse() {
        const newGate = new Gate(this.gateID, this.inputs)
        newGate.controls = this.controls
        newGate.originalMatrix = await this.originalMatrix.inverse()
        return newGate
    }

    async power(exponent) {
        const newGate = new Gate(this.gateID, this.inputs)
        newGate.controls = this.controls
        newGate.originalMatrix = await this.originalMatrix.power(exponent)
        return newGate
    }

    // the control always becomes the 0th qbit
    async addControl() {
        if (this.gateID == "GPHASE") {
            const newGate = new Gate("GPHASE", this.inputs)
            newGate.controls = this.controls
            newGate.controls.push("pos")
            return newGate
        }

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

            const newGate = new Gate("CUSTOM", this.inputs)
            newGate.originalMatrix = newMatrix
            newGate.qbitsAffected = Math.log2(newDimension)
            newGate.controls = this.controls
            newGate.controls.push("pos")

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

            let newGate = new Gate("CUSTOM", this.inputs)
            newGate.originalMatrix = new ComplexMatrix(newDimension, newDimension, newRealTexture, newImaginaryTexture, this.originalMatrix.hasReal, this.originalMatrix.hasImaginary)
            newGate.qbitsAffected = Math.log2(newDimension)
            newGate.controls = this.controls
            newGate.controls.push("pos")

            return newGate
        }

    }

    // the control always becomes the 0th qbit
    async addNegativeControl() {
        if (this.gateID == "GPHASE") {
            const newGate = new Gate("GPHASE", this.inputs)
            newGate.controls = this.controls
            newGate.controls.push("neg")
            return newGate
        }

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

            const newGate = new Gate("CUSTOM", this.inputs)
            newGate.originalMatrix = newMatrix
            newGate.qbitsAffected = Math.log2(newDimension)
            newGate.controls = this.controls
            newGate.controls.push("neg")

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

            let newGate = new Gate("CUSTOM", this.inputs)
            newGate.originalMatrix = new ComplexMatrix(newDimension, newDimension, newRealTexture, newImaginaryTexture, this.originalMatrix.hasReal, this.originalMatrix.hasImaginary)
            newGate.qbitsAffected = Math.log2(newDimension)
            newGate.controls = this.controls
            newGate.controls.push("neg")

            return newGate
        }

    }

    // we are assuming all controls are consecutive and after firstControl, an algorithm should have already been done
    async getStateMatrixGPhase(numQbits, qbits) {
        const phase = this.inputs[0]
        const dimension = 2 ** numQbits

        // compiling the controls as an array to be defined in the shader
        let controlsString = `const controls = array<vec2u, ${this.controls.length}> (`
        for (let i = this.controls.length - 1; i >= 0; i--) {
            controlsString += `vec2u(${qbits[this.controls.length-i-1]}, ${this.controls[i] == "pos" ? 1 : 0}), `
        }
        controlsString += ");"

        const newRealTexture = device.createTexture({
            dimension: "2d",
            size: [dimension, dimension, 1],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })

        const newImaginaryTexture = device.createTexture({
            dimension: "2d",
            size: [dimension, dimension, 1],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })

        const gModule = device.createShaderModule({
            label: "gphase matrix module",
            code: (await loadWGSL("./shaders/gphase.wgsl")).replace("_CONTROLS", controlsString).replace("_PHASE", phase).replace("_NUMCONTROLS", this.controls.length)
        })

        const gPipeline = device.createComputePipeline({
            label: "gphase matrix pipeline",
            layout: "auto",
            compute: {
                module: gModule
            }
        })

        const gBindGroup = device.createBindGroup({
            label: "gphase bind group",
            layout: gPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: newRealTexture.createView() },
                { binding: 1, resource: newImaginaryTexture.createView() }
            ]
        })

        const gEncoder = device.createCommandEncoder()
        const gPass = gEncoder.beginComputePass()
        gPass.setPipeline(gPipeline)
        gPass.setBindGroup(0, gBindGroup)
        gPass.dispatchWorkgroups(dimension, 1, 1) //only one non-zero entry per column
        gPass.end()

        device.queue.submit([gEncoder.finish()])

        const newMatrix = new ComplexMatrix(
            dimension, dimension,
            newRealTexture, newImaginaryTexture,
            Math.cos(phase) !== 0 || this.controls.length > 0, //real exists if there is a control and for most phases
            Math.sin(phase) !== 0 //imaginary exists for most phases
        )

        this.stateMatrix = newMatrix

        return this.stateMatrix
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

    async apply(state, qbits) { //by convention the first qbits are the control (most recently added control first) and the last are the target
        if (this.gateID == "SWAP") {
            return await state.swap(qbits[0], qbits[1])
        }

        else if (this.gateID == "GPHASE") { // GPHASE will be different: it changes the phase of all qbits but we also have to take into account control(s)
            await this.getStateMatrixGPhase(state.numQbits, qbits)
            const newStateVector = await this.stateMatrix.multiplyComplexVector(state.vector)
            return new State(state.numQbits, newStateVector)
        }

        else {
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
}

// ! adding the controls should not be done in script.js, it should be done whenever is actually best to do it (the latest possible) because of powers and inverse