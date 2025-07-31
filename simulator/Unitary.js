class Unitary {
    constructor(theta, phi, lambda) { //theta, phi, or lambda might be functions whose inputs are defined later, in that case, they are written as [inputIndex, function]
        this.original = {}
        this.modified = {}

        this.theta = theta; this.phi = phi; this.lambda = lambda

        this.previousParameters = undefined // keeps track of the parameters to this unitary the last time it was called. if it's the same as last time, less work needs to be done when applying

        this.numQbitsApplied = 1
        this.numInputs = 0
        if (typeof (this.theta) !== "number") { this.numInputs++ } //it takes in an input if it's not a number
        if (typeof (this.phi) !== "number") { this.numInputs++ }
        if (typeof (this.lambda) !== "number") { this.numInputs++ }

        // some unitaries have only one row filled in for each real and imaginary, but im ignoring that potential speed up
    }

    getOriginalMatrix(inputs) {
        let theta, phi, lambda

        if (typeof (this.theta) == "number") { theta = this.theta }
        else { theta = this.theta[1](inputs[this.theta[0]]) } //this.theta[1] is a function, and it takes as an input the value at index this.theta[0]

        if (typeof (this.phi) == "number") { phi = this.phi }
        else { phi = this.phi[1](inputs[this.phi[0]]) }

        if (typeof (this.lambda) == "number") { lambda = this.lambda }
        else { lambda = this.lambda[1](inputs[this.lambda[0]]) }

        const sinTheta2 = sin(theta / 2)
        const cosTheta2 = cos(theta / 2)

        this.original.real = [
            [
                correct0Precision(cosTheta2),
                correct0Precision(-cos(lambda) * sinTheta2)
            ],
            [
                correct0Precision(cos(phi) * sinTheta2),
                correct0Precision(cos(phi + lambda) * cosTheta2)
            ]
        ]
        this.original.imag = [
            [
                0,
                correct0Precision(-sin(lambda) * sinTheta2)
            ],
            [
                correct0Precision(sin(phi) * sinTheta2),
                correct0Precision(sin(phi + lambda) * cosTheta2)
            ]
        ]

        this.original.has2ColPerRow =
            ((!equals0(this.original.real[0][0]) || !equals0(this.original.imag[0][0])) && (!equals0(this.original.real[0][1]) || !equals0(this.original.imag[0][1])))
            ||
            ((!equals0(this.original.real[1][0]) || !equals0(this.original.imag[1][0])) && (!equals0(this.original.real[1][1]) || !equals0(this.original.imag[1][1])))

    }

    // applies the power and inverse modifiers to this.original to get this.modified
    getModifiedMatrix(inputs, modifiers) {
        // first get the original matrix taking into account the inputs
        this.getOriginalMatrix(inputs)

        let exponent = 1
        for (let i = 0; i < modifiers.length; i++) {
            if (modifiers[i].type == "power") {
                exponent *= modifiers[i].value
            }
            else if (modifiers[i].type == "inverse") {
                exponent *= -1
            }
        }

        if (exponent == 1) {
            this.modified = this.original
        }
        else if (exponent == -1) {
            this.inverse()
        }
        else {
            this.power(exponent)
        }

        this.modified.has2ColPerRow =
            ((!equals0(this.modified.real[0][0]) || !equals0(this.modified.imag[0][0])) && (!equals0(this.modified.real[0][1]) || !equals0(this.modified.imag[0][1])))
            ||
            ((!equals0(this.modified.real[1][0]) || !equals0(this.modified.imag[1][0])) && (!equals0(this.modified.real[1][1]) || !equals0(this.modified.imag[1][1])))
    }

    inverse() {
        this.modified.real = [
            [this.original.real[0][0], this.original.real[1][0]],
            [this.original.real[0][1], this.original.real[1][1]]
        ]

        this.modified.imag = [
            [-this.original.imag[0][0], -this.original.imag[1][0]],
            [-this.original.imag[0][1], -this.original.imag[1][1]]
        ]
    }

    power(exponent) { //raises the matrix to a power

        // A^k = P K^k P^-1

        const eigenvaluesEigenvectors = getEigenvaluesEigenvectors2x2(this.original)

        const lambda1r = eigenvaluesEigenvectors[0].eigenvalue.real
        const lambda1i = eigenvaluesEigenvectors[0].eigenvalue.imag

        const lambda2r = eigenvaluesEigenvectors[1].eigenvalue.real
        const lambda2i = eigenvaluesEigenvectors[1].eigenvalue.imag

        const v1 = eigenvaluesEigenvectors[0].eigenvector
        const v2 = eigenvaluesEigenvectors[1].eigenvector

        // finding lambda 1 and 2 after being exponentiated
        // first convert to polar
        const r1 = Math.sqrt(lambda1r ** 2 + lambda1i ** 2)
        const theta1 = Math.atan2(lambda1i, lambda1r)

        const r2 = Math.sqrt(lambda2r ** 2 + lambda2i ** 2)
        const theta2 = Math.atan2(lambda2i, lambda2r)

        // then exponentiate and convert back to components
        const lambda1kr = r1 ** exponent * cos(exponent * theta1)
        const lambda1ki = r1 ** exponent * sin(exponent * theta1)

        const lambda2kr = r2 ** exponent * cos(exponent * theta2)
        const lambda2ki = r2 ** exponent * sin(exponent * theta2)

        const Pr = [
            [v1.real[0], v2.real[0]],
            [v1.real[1], v2.real[1]]
        ]

        const Pi = [
            [v1.imag[0], v2.imag[0]],
            [v1.imag[1], v2.imag[1]]
        ]

        const PDagr = [
            [Pr[0][0], Pr[1][0]],
            [Pr[0][1], Pr[1][1]]
        ]
        const PDagi = [
            [-Pi[0][0], -Pi[1][0]],
            [-Pi[0][1], -Pi[1][1]]
        ]

        function cMultR(r1, i1, r2, i2) {
            return r1 * r2 - i1 * i2
        }
        function cMultI(r1, i1, r2, i2) {
            return r1 * i2 + i1 * r2
        }

        // K P^-1
        const K_PDag_r = [
            [cMultR(lambda1kr, lambda1ki, PDagr[0][0], PDagi[0][0]), cMultR(lambda1kr, lambda1ki, PDagr[0][1], PDagi[0][1])],
            [cMultR(lambda2kr, lambda2ki, PDagr[1][0], PDagi[1][0]), cMultR(lambda2kr, lambda2ki, PDagr[1][1], PDagi[1][1])]
        ]
        const K_PDag_i = [
            [cMultI(lambda1kr, lambda1ki, PDagr[0][0], PDagi[0][0]), cMultI(lambda1kr, lambda1ki, PDagr[0][1], PDagi[0][1])],
            [cMultI(lambda2kr, lambda2ki, PDagr[1][0], PDagi[1][0]), cMultI(lambda2kr, lambda2ki, PDagr[1][1], PDagi[1][1])]
        ]

        // P (K P^-1) = A^k
        const A_K_r = [
            [
                cMultR(Pr[0][0], Pi[0][0], K_PDag_r[0][0], K_PDag_i[0][0]) + cMultR(Pr[0][1], Pi[0][1], K_PDag_r[1][0], K_PDag_i[1][0]),
                cMultR(Pr[0][0], Pi[0][0], K_PDag_r[0][1], K_PDag_i[0][1]) + cMultR(Pr[0][1], Pi[0][1], K_PDag_r[1][1], K_PDag_i[1][1]),
            ],
            [
                cMultR(Pr[1][0], Pi[1][0], K_PDag_r[0][0], K_PDag_i[0][0]) + cMultR(Pr[1][1], Pi[1][1], K_PDag_r[1][0], K_PDag_i[1][0]),
                cMultR(Pr[1][0], Pi[1][0], K_PDag_r[0][1], K_PDag_i[0][1]) + cMultR(Pr[1][1], Pi[1][1], K_PDag_r[1][1], K_PDag_i[1][1]),
            ]
        ]
        const A_K_i = [
            [
                cMultI(Pr[0][0], Pi[0][0], K_PDag_r[0][0], K_PDag_i[0][0]) + cMultI(Pr[0][1], Pi[0][1], K_PDag_r[1][0], K_PDag_i[1][0]),
                cMultI(Pr[0][0], Pi[0][0], K_PDag_r[0][1], K_PDag_i[0][1]) + cMultI(Pr[0][1], Pi[0][1], K_PDag_r[1][1], K_PDag_i[1][1]),
            ],
            [
                cMultI(Pr[1][0], Pi[1][0], K_PDag_r[0][0], K_PDag_i[0][0]) + cMultI(Pr[1][1], Pi[1][1], K_PDag_r[1][0], K_PDag_i[1][0]),
                cMultI(Pr[1][0], Pi[1][0], K_PDag_r[0][1], K_PDag_i[0][1]) + cMultI(Pr[1][1], Pi[1][1], K_PDag_r[1][1], K_PDag_i[1][1]),
            ]
        ]

        this.modified.real = A_K_r
        this.modified.imag = A_K_i
    }

    async getGateMatrix(numQbits, inputs, modifiers) { // controlQbits match the order of the modifiers added, where the last modifier added will correspond to the last entry in controlQbits
        this.getModifiedMatrix(inputs, modifiers)

        let controls = []

        let j = 0
        for (let i = 0; i < modifiers.length; i++) {
            if (modifiers[i].type == "control") {
                controls.push("pos")
                j++
            }
            else if (modifiers[i].type == "negativeControl") {
                controls.push("neg")
                j++
            }
        }
        const G = new GateMatrix(this, numQbits, controls)
        await G.create()

        this.gateMatrix = G
        return this.gateMatrix
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