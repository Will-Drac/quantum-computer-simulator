class SingleGate {
    constructor(gateID, phase) { //phase is used as the input if the gate is P
        this.originalMatrix = new ComplexMatrix(2, 2)

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
}

class DoubleGate {
    constructor(gateID) {
        if (gateID == "SWAP") {
            
        }
    }
}

// SWAP gate