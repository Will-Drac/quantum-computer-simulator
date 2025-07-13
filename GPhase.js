class GPhase {
    constructor(phase) {
        this.phase = phase
        this.modifiers = []
    }

    modify(modifier) {
        this.modifiers.push(modifier)
    }

    async getGateMatrix(numQbits) { // controlQbits match the order of the modifiers added, where the last modifier added will correspond to the last entry in controlQbits
        let numControls = 0
        for (let i = 0; i < this.modifiers.length; i++) {
            if (this.modifiers[i].type == "control" || this.modifiers[i].type == "negativeControl") {
                numControls++
            }
        }
        const uncontrolledSize = 2 ** (numQbits - numControls)
        const workgroupsPerDimension = Math.ceil(Math.sqrt(uncontrolledSize))

        // before the controls, this would just be a e^(i*phase) * I_(2^n)
        // this will be a bit different from a normal GateMatrix. There will always be 1 non-zero entry per column, and it will either be e^(i*phase) or 1
        // so we can just have one buffer, and have only the first bit for 1 or phase multiplier, then keep the second bit empty because it's useless

        // first, add phase to all non-controlled qbits

        const gModule = device.createShaderModule({
            code: (await loadWGSL("shaders/gphase.wgsl"))
                .replace("_SIZE", 2 ** numQbits)
                .replace("_WORKGROUPSPERDIM", workgroupsPerDimension)
        })

        const gPipeline = device.createComputePipeline({
            layout: "auto",
            compute: { module: gModule }
        })

        this.gateMatrix = device.createBuffer({
            size: 4 * uncontrolledSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        })

        const gBindGroup = device.createBindGroup({
            layout: gPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.gateMatrix } }
            ]
        })

        const gEncoder = device.createCommandEncoder()
        const gPass = gEncoder.beginComputePass()
        gPass.setPipeline(gPipeline)
        gPass.setBindGroup(0, gBindGroup)
        gPass.dispatchWorkgroups(workgroupsPerDimension, workgroupsPerDimension, 1)
        gPass.end()

        device.queue.submit([gEncoder.finish()])

        // now to add the controls

        for (let i = 0; i < this.modifiers.length; i++) {
            if (this.modifiers[i].type == "control") {
                this.gateMatrix = await this.addControlGateMatrix("pos", this.gateMatrix)
            }
            else if (this.modifiers[i].type == "negativeControl") {
                this.gateMatrix = await this.addControlGateMatrix("neg", this.gateMatrix)
            }
        }
    }

    async addControlGateMatrix(type, entries) {
        const oldSize = entries.size / 4
        const newSize = oldSize * 2
        const workgroupsPerDimension = Math.ceil(Math.sqrt(newSize))

        const cModule = device.createShaderModule({
            code: (await loadWGSL(type == "pos" ? "shaders/addControl.wgsl" : "shaders/addNegativeControl.wgsl"))
                .replace("_SIZE", newSize)
                .replace("_WORKGROUPSPERDIM", workgroupsPerDimension)
                .replace("_ISENTRIES0", true) //there is only one entry buffer for a gphase
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

    async apply(state, controlQbits) {
        await this.getGateMatrix(state.numQbits)

        // we need to take into account the non-control modifiers in how this gate is changing the phase
        let phaseChange = this.phase
        for (let i = 0; i < this.modifiers.length; i++) {
            if (this.modifiers[i].type == "power") {
                phaseChange *= this.modifiers[i].value
            }
            else if (this.modifiers[i].type == "inverse") {
                phaseChange *= -1
            }
        }

        // now we're going to use apply1Col.wgsl to multiply gateMatrix with the state

        // first, we need to swap qbits in the state because the controls are always being applied to just the first entries
        let qbitsCurrentLocations = []
        for (let i = 0; i < controlQbits.length; i++) {
            qbitsCurrentLocations.push(controlQbits.length - i - 1)
        }

        let qbitsTargetLocations = controlQbits

        let inverseSwaps = []
        for (let i = 0; i < qbitsCurrentLocations.length; i++) {
            // console.log(qbitsCurrentLocations, qbitsTargetLocations)
            if (qbitsCurrentLocations[i] !== qbitsTargetLocations[i]) {
                inverseSwaps.push([qbitsCurrentLocations[i], qbitsTargetLocations[i]])

                // if we happened to displace another important one, keep track of that
                for (let j = 0; j < qbitsCurrentLocations.length; j++) {
                    if (qbitsCurrentLocations[j] == qbitsTargetLocations[i]) {
                        qbitsCurrentLocations[j] = qbitsCurrentLocations[i]
                    }
                }

                qbitsCurrentLocations[i] = qbitsTargetLocations[i] //keep track of the intended switch too
            }
        }

        let swaps = []
        for (let i = inverseSwaps.length - 1; i >= 0; i--) {
            swaps.push(inverseSwaps[i])
        }

        // after multiplying, we need to put the qbits back in order. that's what inverseSwaps is for

        await state.swap(swaps)

        const workgroupsPerDimension = Math.ceil(Math.sqrt(2 ** state.numQbits))

        // gphase doesnt have a matrix like a unitary, but let's just fill it with the multiplier for phase and it will work
        const phaseMultReal = Math.cos(phaseChange)
        const phaseMultImag = Math.sin(phaseChange)

        const matrixEntriesCode = `
        const matrixEntriesReal = vec4f(${phaseMultReal}, ${phaseMultReal}, ${phaseMultReal}, ${phaseMultReal});
        const matrixEntriesImag = vec4f(${phaseMultImag}, ${phaseMultImag}, ${phaseMultImag}, ${phaseMultImag});
        `

        // the matrix entries only actually contain references to row 0 when the entry isnt just the value 1, and the column doesnt matter because the entire matrix as defined above has the same value
        const rowToColCode = `
        const rowToCol = vec2u(0, 0);
        `

        const aModule = device.createShaderModule({
            code: (await loadWGSL("shaders/apply1Col.wgsl"))
                .replace("_ENTRIES", matrixEntriesCode)
                .replace("_ROWCOL", rowToColCode)
                .replace("_WORKGROUPSPERDIM", workgroupsPerDimension)
                .replace("_SIZE", 2 ** state.numQbits)
        })

        const aPipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
                module: aModule
            }
        })

        const newVector = {
            real: device.createBuffer({
                size: 4 * 2 ** state.numQbits,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
            }),
            imag: device.createBuffer({
                size: 4 * 2 ** state.numQbits,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
            })
        }

        const aBindGroup = device.createBindGroup({
            layout: aPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.gateMatrix } },
                { binding: 1, resource: { buffer: state.vector.real } },
                { binding: 2, resource: { buffer: state.vector.imag } },
                { binding: 3, resource: { buffer: newVector.real } },
                { binding: 4, resource: { buffer: newVector.imag } }
            ]
        })

        const aEncoder = device.createCommandEncoder()
        const aPass = aEncoder.beginComputePass()
        aPass.setPipeline(aPipeline)
        aPass.setBindGroup(0, aBindGroup)
        aPass.dispatchWorkgroups(workgroupsPerDimension, workgroupsPerDimension, 1)
        aPass.end()

        device.queue.submit([aEncoder.finish()])

        state.vector = newVector

        await state.swap(inverseSwaps)
    }
}