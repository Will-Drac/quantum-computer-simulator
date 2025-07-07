class Modifier {
    constructor(type, value) { //types control, negativeControl, power, inverse; power uses `value` for the exponent
        this.type = type
        this.value = value
    }
}

class Unitary {
    constructor(theta, phi, lambda) {
        this.original = {}
        this.modified = {}

        this.original.real = [
            [
                0.5 * (1 + Math.cos(theta)),
                0.5 * (Math.sin(lambda) * (1 - Math.cos(theta)) - Math.cos(lambda) * Math.sin(theta))
            ],
            [
                0.5 * (Math.cos(phi) * Math.sin(theta)) - Math.sin(phi) * (1 - Math.cos(theta)),
                0.5 * (Math.cos(phi + lambda) * (1 + Math.cos(theta)) - Math.sin(phi + lambda) * Math.sin(theta))
            ]
        ]
        this.original.imag = [
            [
                0.5 * (Math.sin(theta)),
                0.5 * (-Math.cos(lambda) * (1 - Math.cos(theta)) - Math.sin(lambda) * Math.sin(theta))
            ],
            [
                0.5 * (Math.cos(phi) * (1 - Math.cos(theta)) + Math.sin(phi) * Math.sin(theta)),
                0.5 * (Math.cos(phi + lambda) * Math.sin(theta) + Math.sin(phi + lambda) * (1 + Math.cos(theta)))
            ]
        ]

        this.modifiers = [] //stores a list of Modifiers

        this.original.hasReal = !equals0(this.original.real[0][0]) && !equals0(this.original.real[0][1]) && !equals0(this.original.real[1][0]) && !equals0(this.original.real[1][1])
        this.original.hasImag = !equals0(this.original.imag[0][0]) && !equals0(this.original.imag[0][1]) && !equals0(this.original.imag[1][0]) && !equals0(this.original.imag[1][1])

        this.original.has2ColPerRow =
            (!equals0(this.original.real[0][0]) && !equals0(this.original.real[0][1]) && !equals0(this.original.imag[0][0]) && !equals0(this.original.imag[0][1]))
            ||
            (!equals0(this.original.real[1][0]) && !equals0(this.original.real[1][1]) && !equals0(this.original.imag[1][0]) && !equals0(this.original.imag[1][1]))

        // some unitaries have only one row filled in for each real and imaginary, but im ignoring that potential speed up
    }

    modify(modifier) {
        this.modifiers.push(modifier)
    }

    // applies the power and inverse modifiers to this.original to get this.modified
    getModifiedMatrix() {
        let exponent = 1
        for (let i = 0; i < this.modifiers.length; i++) {
            if (this.modifiers[i].type == "power") {
                exponent *= this.modifiers[i].value
            }
            else if (this.modifiers[i].type == "inverse") {
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
    }

    inverse() {
        if (this.original.hasReal) {
            this.modified.real = [
                [this.original.real[0][0], this.original.real[1][0]],
                [this.original.real[0][1], this.original.real[1][1]]
            ]
            this.modified.hasReal = true
        }
        else {
            this.modified.real = [
                [0, 0],
                [0, 0]
            ]
            this.modified.hasReal = false
        }

        if (this.original.hasImag) {
            this.modified.imag = [
                [-this.original.imag[0][0], -this.original.imag[1][0]],
                [-this.original.imag[0][1], -this.original.imag[1][1]]
            ]
            this.modified.hasImag = true
        }
        else {
            this.modified.imag = [
                [0, 0],
                [0, 0]
            ]
            this.modified.hasImag = false
        }
    }

    power(exponent) { //raises the matrix to a power

        // A^k = P K^k P^-1

        const real = this.original.real
        const imag = this.original.imag

        const tr = real[0][0] + real[1][1]
        const ti = imag[0][0] + imag[1][1]

        const dr = real[0][0] * real[1][1] - imag[0][0] * imag[1][1] - real[1][0] * real[0][1] + imag[1][0] * imag[0][1]
        const di = real[0][0] * imag[1][1] + imag[0][0] * real[1][1] - real[1][0] * imag[0][1] - imag[1][0] * real[0][1]

        const Dr = tr ** 2 - ti ** 2 - 4 * dr
        const Di = 2 * tr * ti - 4 * di

        const R = Math.sqrt(Dr ** 2 + Di ** 2)

        const sr = Math.sqrt((R + Dr) / 2)
        const si = (Di == 0 ? 1 : Math.sign(Di)) * Math.sqrt((R - Dr) / 2)

        // the eigenvalues
        const lambda1r = (tr + sr) / 2
        const lambda1i = (ti + si) / 2

        const lambda2r = (tr - sr) / 2
        const lambda2i = (ti - si) / 2

        // lambda 1 and 2 after being exponentiated
        // first convert to polar
        const r1 = Math.sqrt(lambda1r ** 2 + lambda1i ** 2)
        const theta1 = Math.atan2(lambda1i, lambda1r)

        const r2 = Math.sqrt(lambda2r ** 2 + lambda2i ** 2)
        const theta2 = Math.atan2(lambda2i, lambda2r)

        // then exponentiate and convert back to components
        const lambda1kr = r1 ** exponent * Math.cos(exponent * theta1)
        const lambda1ki = r1 ** exponent * Math.sin(exponent * theta1)

        const lambda2kr = r2 ** exponent * Math.cos(exponent * theta2)
        const lambda2ki = r2 ** exponent * Math.sin(exponent * theta2)

        // finding eigenvectors
        // solutions to (A - lambda I) v = 0  let B = (A - lambda I) for both lambda

        const B1r = [
            [real[0][0] - lambda1r, real[0][1]],
            [real[1][0], real[1][1] - lambda1r]
        ]
        const B1i = [
            [imag[0][0] - lambda1i, imag[0][1]],
            [imag[1][0], imag[1][1] - lambda1i]
        ]

        const B2r = [
            [real[0][0] - lambda2r, real[0][1]],
            [real[1][0], real[1][1] - lambda2r]
        ]
        const B2i = [
            [imag[0][0] - lambda2i, imag[0][1]],
            [imag[1][0], imag[1][1] - lambda2i]
        ]

        // finding a solution for B1 and B2

        function getNullSolutions(Mr, Mi) {
            // debugger
            if (Mr[0][0] == 0 && Mi[0][0] == 0) {
                if (Mr[1][0] == 0 && Mi[1][0] == 0) {
                    /*
                    0 a => [anything, 0], choose [1, 0]
                    0 b
                    */
                    return { real: [1, 0], imaginary: [0, 0] }
                }
                else {
                    /*
                    0 a? => swap rows
                    c d?
                    */
                    Mr[0][0] = Mr[1][0]; Mr[0][1] = Mr[1][1]
                    Mi[0][0] = Mi[1][0]; Mi[0][1] = Mi[1][1]
                }
            }

            /*
            a  b?
            c? d?
            */

            if (Mr[1][0] !== 0 || Mi[1][0] !== 0) {
                // R2 = R2 - c/a R1
                // but |M| = 0 => b - cd/a = 0 so the second row becomes 0
                Mr[1][0] = 0; Mi[1][0] = 0; Mr[1][1] = 0; Mi[1][1] = 0
            }
            /* else
                a b? => a b?  b/c  ad - bc = 0
                0 d?    0 0
            */

            if (Mr[0][1] == 0 && Mi[0][1] == 0) {
                /*
                a 0 => [0, anything] choose [0, 1]
                0 0
                */
                return { real: [0, 1], imaginary: [0, 0] }
            }
            else {
                /*
                a b => ax + by = 0 => choose y = 1 => x = -b/a
                0 0
                */
                const ar = Mr[0][0]; const ai = Mi[0][0]
                const br = Mr[0][1]; const bi = Mi[0][1]
                const d = ar ** 2 + ai ** 2
                return { real: [-(ar * br + ai * bi) / d, 1], imaginary: [(ai * br - ar * bi) / d, 0] }
            }
        }

        const v1 = getNullSolutions(B1r, B1i)
        const v2 = getNullSolutions(B2r, B2i)

        // normalizing the solutions

        const v1L = Math.sqrt(v1.real[0] ** 2 + v1.real[1] ** 2 + v1.imaginary[0] ** 2 + v1.imaginary[1] ** 2)
        const v2L = Math.sqrt(v2.real[0] ** 2 + v2.real[1] ** 2 + v2.imaginary[0] ** 2 + v2.imaginary[1] ** 2)

        v1.real[0] = v1.real[0] / v1L; v1.imaginary[0] = v1.imaginary[0] / v1L
        v1.real[1] = v1.real[1] / v1L; v1.imaginary[1] = v1.imaginary[1] / v1L

        v2.real[0] = v2.real[0] / v2L; v2.imaginary[0] = v2.imaginary[0] / v2L
        v2.real[1] = v2.real[1] / v2L; v2.imaginary[1] = v2.imaginary[1] / v2L


        const Pr = [
            [v1.real[0], v2.real[0]],
            [v1.real[1], v2.real[1]]
        ]

        const Pi = [
            [v1.imaginary[0], v2.imaginary[0]],
            [v1.imaginary[1], v2.imaginary[1]]
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

        // this might not actually be true, but i dont care really, good enough
        this.modified.hasReal = true
        this.modified.hasImag = true
    }

    async getGateMatrix(numQbits, controlQbits, qbitApplied) { // controlQbits match the order of the modifiers added, where the last modifier added will correspond to the last entry in controlQbits
        this.getModifiedMatrix()

        let controls = []

        let j = 0
        for (let i = 0; i < this.modifiers.length; i++) {
            if (this.modifiers[i].type == "control") {
                controls.push([controlQbits[j], "pos"])
                j++
            }
            else if (this.modifiers[i].type == "negativeControl") {
                controls.push([controlQbits[j], "neg"])
                j++
            }
        }
        const G = new GateMatrix(this, numQbits, controls, qbitApplied)
        await G.create()

        this.gateMatrix = G
        return this.gateMatrix
    }
}