class GPhase {
    constructor(phase) {
        this.phase = phase
        this.previousParameters = undefined

        this.numQbitsApplied = 0
        this.numInputs = 0
        if (typeof (this.phase) !== "number") { this.numInputs++ }
    }

    // GPhase doesnt have a matrix like a Unitary does, this is just for parity. GPhase will simply make all diagonals to be cosφ + isinφ
    getModifiedMatrix(inputs, modifiers) {
        let phaseChange
        if (typeof (this.phase) == "number") { phaseChange = this.phase }
        else { phaseChange = this.phase[1](inputs[this.phase[0]]) }

        // we need to take into account the non-control modifiers in how this gate is changing the phase
        for (let i = 0; i < modifiers.length; i++) {
            if (modifiers[i].type == "power") {
                phaseChange *= modifiers[i].value
            }
            else if (modifiers[i].type == "inverse") {
                phaseChange *= -1
            }
        }

        const cosPhase = cos(phaseChange)
        const sinPhase = sin(phaseChange)

        this.modified = {}

        this.modified.real = [
            [cosPhase, cosPhase],
            [cosPhase, cosPhase]
        ]

        this.modified.imag = [
            [sinPhase, sinPhase],
            [sinPhase, sinPhase]
        ]

        this.modified.has2ColPerRow = false
    }

    async getGateMatrix(numQbits, inputs, modifiers) { //inputs aren't used here yet, 
        this.getModifiedMatrix(inputs, modifiers)

        let numControls = 0
        for (let i = 0; i < modifiers.length; i++) {
            if (modifiers[i].type == "control" || modifiers[i].type == "negativeControl") {
                numControls++
            }
        }
        const uncontrolledSize = 2 ** (numQbits - numControls)
        const workgroupsPerDimension = Math.ceil(Math.sqrt(uncontrolledSize))

        // before the controls, this would just be a e^(i*phase) * I_(2^n)
        // this will be a bit different from a normal GateMatrix. There will always be 1 non-zero entry per column, and it will either be e^(i*phase) or 1
        // so we can just have one buffer, and have only the first bit for 1 or phase multiplier, then keep the second bit empty because it's useless

        // first, add phase to all non-controlled qbits

        // it's defined in a weird way for parity with a Unitary, which needs a more sophisticated gateMatrix object
        this.gateMatrix = {
            entries: [
                device.createBuffer({
                    size: 4 * uncontrolledSize,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
                })
            ],
            row0Col: 0,
            row1Col: 0
        }

        runComputeShader(
            (await loadWGSL("./simulator/shaders/gphase.wgsl"))
                .replace("_SIZE", 2 ** numQbits)
                .replace("_WORKGROUPSPERDIM", workgroupsPerDimension),

            [{ binding: 0, resource: { buffer: this.gateMatrix.entries[0] } }],

            [workgroupsPerDimension, workgroupsPerDimension, 1]
        )

        // now to add the controls

        for (let i = 0; i < modifiers.length; i++) {
            if (modifiers[i].type == "control") {
                this.gateMatrix.entries[0] = await this.addControlGateMatrix("pos", this.gateMatrix.entries[0])
            }
            else if (modifiers[i].type == "negativeControl") {
                this.gateMatrix.entries[0] = await this.addControlGateMatrix("neg", this.gateMatrix.entries[0])
            }
        }
    }

    async addControlGateMatrix(type, entries) {
        const oldSize = entries.size / 4
        const newSize = oldSize * 2
        const workgroupsPerDimension = Math.ceil(Math.sqrt(newSize))

        const newEntries = device.createBuffer({
            size: 4 * newSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        })

        runComputeShader(
            (await loadWGSL(type == "pos" ? "./simulator/shaders/addControl.wgsl" : "./simulator/shaders/addNegativeControl.wgsl"))
                .replace("_SIZE", newSize)
                .replace("_WORKGROUPSPERDIM", workgroupsPerDimension)
                .replace("_ISENTRIES0", true), //there is only one entry buffer for a gphase

            [
                { binding: 0, resource: { buffer: entries } },
                { binding: 1, resource: { buffer: newEntries } }
            ],

            [workgroupsPerDimension, workgroupsPerDimension, 1]
        )

        return newEntries
    }

    // checks if the current gate matrix has the same parameters as the current application call
    gateMatrixUpToDate(numQbits, inputs, modifiers) {
        if (this.previousParameters == undefined) {
            this.previousParameters = { numQbits, inputs, temporaryModifiers: modifiers }
            return false
        }

        let temporaryModifiersMatch = true
        if (this.previousParameters.temporaryModifiers.length == modifiers.length) {
            for (let i = 0; i < modifiers.length; i++) {
                if (
                    this.previousParameters.temporaryModifiers[i].type !== modifiers[i].type
                    ||
                    this.previousParameters.temporaryModifiers[i].value !== modifiers[i].value
                ) {
                    temporaryModifiersMatch = false
                    break
                }
            }
        }
        else {
            temporaryModifiersMatch = false
        }

        let inputsMatch = true
        for (let i = 0; i < inputs.length; i++) {
            if (this.previousParameters.inputs[i] !== inputs[i]) { inputsMatch = false; break }
        }

        let upToDate =
            this.previousParameters.numQbits == numQbits
            &&
            inputsMatch
            &&
            temporaryModifiersMatch

        this.previousParameters = { numQbits, inputs, temporaryModifiers: modifiers }

        return upToDate
    }
}