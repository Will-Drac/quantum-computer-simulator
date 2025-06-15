class Gate {
    constructor(gateID, inputs) {
        this.gateID = gateID
        this.qbitsAffected = GateDefinitions[gateID].size

        if (gateID !== "SWAP") { //swap works with its own shader
            this.originalMatrix = new ComplexMatrix(2**this.qbitsAffected, 2**this.qbitsAffected)

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
            state = await state.swap(qbits[i-1]+1, qbits[i])
            updateQbitsToSwap(qbits[i-1]+1, qbits[i])
        }

        await this.getStateMatrix(state.numQbits, qbits[0])
        const newStateVector = await this.stateMatrix.multiplyComplexVector(state.vector)
        let newState = new State(state.numQbits, newStateVector)

        // going through the swaps backwards to undo them
        for (let i = qbitSwaps.length-1; i >= 0; i--) {
            newState = await newState.swap(qbitSwaps[i][0], qbitSwaps[i][1])
        }

        return newState
    }
}