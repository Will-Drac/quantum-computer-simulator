class SingleGate {
    constructor(gateID, phase) { //phase is used as the input if the gate is P
        this.originalMatrix = new ComplexMatrix(2, 2)
        this.gateID = gateID

        if (gateID == "P") {
            this.originalMatrix.real.entries = [
                [1, 0],
                [0, Math.cos(phase)]
            ]
            this.originalMatrix.imaginary.entries = [
                [0, 0],
                [0, Math.sin(phase)]
            ]
            this.originalMatrix.hasReal = true; this.originalMatrix.hasImaginary = Math.sin(phase) !== 0
        }
        else {
            this.originalMatrix.hasReal = GateDefinitions[gateID].hasReal
            if (this.originalMatrix.hasReal) {
                this.originalMatrix.real.entries = GateDefinitions[gateID].real
            }

            this.originalMatrix.hasImaginary = GateDefinitions[gateID].hasImaginary
            if (this.originalMatrix.hasImaginary) {
                this.originalMatrix.imaginary.entries = GateDefinitions[gateID].imaginary
            }
        }

        this.originalMatrix.real.getTexture()
        this.originalMatrix.imaginary.getTexture()
    }

    // gets the matrix that will get multiplied to the state vector
    async getStateMatrix(numQbits, qbitApplied) {
        const I = new IComplexMatrix(2)

        this.stateMatrix = new ComplexMatrix(1, 1, undefined, undefined, true, false)
        this.stateMatrix.real.entries = [[1]]
        this.stateMatrix.real.getTexture()

        for (let i = numQbits - 1; i >= 0; i--) {
            if (i == qbitApplied) {
                this.stateMatrix = await this.stateMatrix.kronecker(this.originalMatrix)
            }
            else {
                this.stateMatrix = await this.stateMatrix.kronecker(I)
            }
        }

        return this.stateMatrix
    }

    async apply(state, qbit) {
        await this.getStateMatrix(state.numQbits, qbit)
        const newStateVector = await this.stateMatrix.multiplyComplexVector(state.vector)
        return new State(state.numQbits, newStateVector)
    }
}

class DoubleGate {
    constructor(gateID) {
        this.gateID = gateID

        if (gateID !== "SWAP") {
            this.originalMatrix = new ComplexMatrix(4, 4)

            this.originalMatrix.hasReal = GateDefinitions[gateID].hasReal
            if (this.originalMatrix.hasReal) {
                this.originalMatrix.real.entries = GateDefinitions[gateID].real
            }

            this.originalMatrix.hasImaginary = GateDefinitions[gateID].hasImaginary
            if (this.originalMatrix.hasImaginary) {
                this.originalMatrix.imaginary.entries = GateDefinitions[gateID].imaginary
            }

            this.originalMatrix.real.getTexture()
            this.originalMatrix.imaginary.getTexture()
        }
    }

    async getStateMatrix(numQbits, firstQbit) { //this state matrix will affect two qbits, but we're assuming they are consecutive, at firstQbit and firstQbit+1
        const I = new IComplexMatrix(2)
        this.stateMatrix = new ComplexMatrix(1, 1, undefined, undefined, true, false)
        this.stateMatrix.real.entries = [[1]]
        this.stateMatrix.real.getTexture()

        for (let i = numQbits - 1; i >= 0; i--) {
            if (i == firstQbit) {
                this.stateMatrix = await this.stateMatrix.kronecker(this.originalMatrix)
            }
            else if (i !== firstQbit + 1) {
                this.stateMatrix = await this.stateMatrix.kronecker(I)
            }
        }

        return this.stateMatrix
    }

    async apply(state, qbit1, qbit2) { //for CNOT, qbit1 is the target and qbit2 is the control
        if (this.gateID == "SWAP") {
            return await state.swap(qbit1, qbit2)
        }

        else {
            let swapped1ToStart = false
            let oldQbit1 = qbit1

            if (qbit1 == state.numQbits - 1) { //of qbit1 is the last qbit, we need to move it because qbit2 should be after it
                state = await state.swap(qbit1, 0)
                qbit1 = 0
                swapped1ToStart = true

                if (qbit2 == 0) { //if it was qbit2 at 0, take that into account
                    qbit2 = oldQbit1
                }

                console.log(0, "swapped", oldQbit1, 0)
            }

            let swappedForAdjacency = false
            if (qbit1 + 1 !== qbit2) {
                state = await state.swap(qbit1 + 1, qbit2)
                swappedForAdjacency = true
                console.log(1, "swapped", qbit1 + 1, qbit2)
            }

            console.log("before multiplication:", await state.getProbabilities())
            await this.getStateMatrix(state.numQbits, qbit1)
            const newStateVector = await this.stateMatrix.multiplyComplexVector(state.vector)
            const multipliedState = new State(state.numQbits, newStateVector)
            console.log("after multiplication: ", await multipliedState.getProbabilities())

            let multipliedSwappedState

            if (swappedForAdjacency) {
                multipliedSwappedState = await multipliedState.swap(qbit1 + 1, qbit2)
                console.log(3, "swapped", qbit1 + 1, qbit2, await multipliedSwappedState.getProbabilities())
            }
            else {
                multipliedSwappedState = multipliedState
            }

            if (swapped1ToStart) {
                multipliedSwappedState = await multipliedSwappedState.swap(0, oldQbit1) //undoing the swap of qbit1 if it existed
                console.log(4, "swapped", 0, oldQbit1, await multipliedSwappedState.getProbabilities())
            }

            return multipliedSwappedState ? multipliedSwappedState : multipliedState
        }
    }
}