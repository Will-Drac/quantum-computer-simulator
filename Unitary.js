class Unitary {
    constructor(theta, phi, lambda) {
        this.real = [
            [
                0.5 * (1 + Math.cos(theta)),
                0.5 * (Math.sin(lambda) * (1 - Math.cos(theta)) - Math.cos(lambda) * Math.sin(theta))
            ],
            [
                0.5 * (Math.cos(phi) * Math.sin(theta)) - Math.sin(phi) * (1 - Math.cos(theta)),
                0.5 * (Math.cos(phi + lambda) * (1 + Math.cos(theta)) - Math.sin(phi + lambda) * Math.sin(theta))
            ]
        ]
        this.imag = [
            [
                0.5 * (Math.sin(theta)),
                0.5 * (-Math.cos(lambda) * (1 - Math.cos(theta)) - Math.sin(lambda) * Math.sin(theta))
            ],
            [
                0.5 * (Math.cos(phi) * (1 - Math.cos(theta)) + Math.sin(phi) * Math.sin(theta)),
                0.5 * (Math.cos(phi + lambda) * Math.sin(theta) + Math.sin(phi + lambda) * (1 + Math.cos(theta)))
            ]
        ]

        this.modifiers = [] //stores things like control, inverse, power in the order of application

        this.hasReal = !equals0(this.real[0][0]) && !equals0(this.real[0][1]) && !equals0(this.real[1][0]) && !equals0(this.real[1][1])
        this.hasImag = !equals0(this.imag[0][0]) && !equals0(this.imag[0][1]) && !equals0(this.imag[1][0]) && !equals0(this.imag[1][1])

        this.has2ColPerRow = (!equals0(this.real[0][0]) && !equals0(this.real[0][1]) && !equals0(this.imag[0][0]) && !equals0(this.imag[0][1])) || (!equals0(this.real[1][0]) && !equals0(this.real[1][1]) && !equals0(this.imag[1][0]) && !equals0(this.imag[1][1]))

        // some unitaries have only one row filled in for each real and imaginary, but im ignoring that potential speed up
    }
}