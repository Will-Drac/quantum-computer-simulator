const GateDefinitions = {
    // singles
    // !gphase
    U: {
        real: function UR(inputs) {
            const theta = inputs[0]; const phi = inputs[1]; const lambda = inputs[2]
            return [
                [
                    0.5 * (1 + Math.cos(theta)),
                    0.5 * (Math.sin(lambda) * (1 - Math.cos(theta)) - Math.cos(lambda) * Math.sin(theta))
                ],
                [
                    0.5 * (Math.cos(phi) * Math.sin(theta)) - Math.sin(phi) * (1 - Math.cos(theta)),
                    0.5 * (Math.cos(phi + lambda) * (1 + Math.cos(theta)) - Math.sin(phi + lambda) * Math.sin(theta))
                ]
            ]
        },
        imaginary: function UI(inputs) {
            const theta = inputs[0]; const phi = inputs[1]; const lambda = inputs[2]
            return [
                [
                    0.5 * (Math.sin(theta)),
                    0.5 * (-Math.cos(lambda) * (1 - Math.cos(theta)) - Math.sin(lambda) * Math.sin(theta))
                ],
                [
                    0.5 * (Math.cos(phi) * (1 - Math.cos(theta)) + Math.sin(phi) * Math.sin(theta)),
                    0.5 * (Math.cos(phi + lambda) * Math.sin(theta) + Math.sin(phi + lambda) * (1 + Math.cos(theta)))
                ]
            ]
        },
        hasReal: true,
        hasImaginary: true,
        size: 1
    },
    I: {
        real: [
            [1, 0],
            [0, 1]
        ],
        imaginary: [
            [0, 0],
            [0, 0]
        ],
        hasReal: true,
        hasImaginary: false,
        size: 1
    },
    X: {
        real: [
            [0, 1],
            [1, 0]
        ],
        imaginary: [
            [0, 0],
            [0, 0]
        ],
        hasReal: true,
        hasImaginary: false,
        size: 1
    },
    Y: {
        real: [
            [0, 0],
            [0, 0]
        ],
        imaginary: [
            [0, -1],
            [1, 0]
        ],
        hasReal: false,
        hasImaginary: true,
        size: 1
    },
    Z: {
        real: [
            [1, 0],
            [0, -1]
        ],
        imaginary: [
            [0, 0],
            [0, 0]
        ],
        hasReal: true,
        hasImaginary: false,
        size: 1
    },
    H: {
        real: [
            [Math.SQRT1_2, Math.SQRT1_2],
            [Math.SQRT1_2, -Math.SQRT1_2]
        ],
        imaginary: [
            [0, 0],
            [0, 0]
        ],
        hasReal: true,
        hasImaginary: false,
        size: 1
    },
    S: {
        real: [
            [1, 0],
            [0, 0]
        ],
        imaginary: [
            [0, 0],
            [0, 1]
        ],
        hasReal: true,
        hasImaginary: true,
        size: 1
    },
    SDG: {
        real: [
            [1, 0],
            [0, 0]
        ],
        imaginary: [
            [0, 0],
            [0, -1]
        ],
        hasReal: true,
        hasImaginary: true,
        size: 1
    },
    T: {
        real: [
            [1, 0],
            [0, Math.SQRT1_2]
        ],
        imaginary: [
            [0, 0],
            [0, Math.SQRT1_2]
        ],
        hasReal: true,
        hasImaginary: true,
        size: 1
    },
    TDG: {
        real: [
            [1, 0],
            [0, Math.SQRT1_2]
        ],
        imaginary: [
            [0, 0],
            [0, -Math.SQRT1_2]
        ],
        hasReal: true,
        hasImaginary: true,
        size: 1
    },
    SX: {
        real: [
            [0.5, 0.5],
            [0.5, 0.5]
        ],
        imaginary: [
            [0.5, -0.5],
            [-0.5, 0.5]
        ],
        hasReal: true,
        hasImaginary: true,
        size: 1
    },
    P: {
        real: function PR(inputs) {
            const lambda = inputs[0]
            return [
                [1, 0],
                [0, Math.cos(lambda)]
            ]
        },
        imaginary: function PI(inputs) {
            const lambda = inputs[0]
            return [
                [0, 0],
                [0, Math.sin(lambda)]
            ]
        },
        hasReal: true,
        hasImaginary: true,
        size: 1
    },
    RX: {
        real: function RXR(inputs) {
            const theta = inputs[0]
            return [
                [Math.cos(theta / 2), 0],
                [0, Math.cos(theta / 2)]
            ]
        },
        imaginary: function RXI(inputs) {
            const theta = inputs[0]
            return [
                [0, -Math.sin(theta / 2)],
                [-Math.sin(theta / 2), 0]
            ]
        },
        hasReal: true,
        hasImaginary: true,
        size: 1
    },
    RY: {
        real: function RYR(inputs) {
            const theta = inputs[0]
            return [
                [Math.cos(theta / 2), -Math.sin(theta / 2)],
                [Math.sin(theta / 2), Math.cos(theta / 2)]
            ]
        },
        imaginary: [
            [0, 0],
            [0, 0]
        ],
        hasReal: true,
        hasImaginary: false,
        size: 1
    },
    RZ: {
        real: function RZR(inputs) {
            const theta = inputs[0]
            return [
                [Math.cos(theta / 2), 0],
                [0, Math.cos(theta / 2)]
            ]
        },
        imaginary: function RZI(inputs) {
            const theta = inputs[0]
            return [
                [-Math.sin(theta / 2), 0],
                [0, Math.sin(theta / 2)]
            ]
        },
        hasReal: true,
        hasImaginary: true,
        size: 1
    },

    // doubles
    CU: {
        real: function CUR(inputs) {
            const theta = inputs[0]; const phi = inputs[1]; const lambda = inputs[2]; const gamma = inputs[3]
            return [
                [1, 0, 0, 0],
                [0, 0.5 * (Math.cos(gamma) + Math.cos(theta + gamma)), 0, 0],
                [0, 0, 1, 0.5 * (Math.sin(lambda + gamma) - Math.sin(theta + lambda + gamma))],
                [0, 0.5 * (-Math.sin(phi + gamma) + Math.sin(theta + phi + gamma)), 0, 0.5 * (Math.cos(phi + lambda + gamma) + Math.cos(theta + phi + lambda + gamma))]
            ]
        },
        imaginary: function CUI(inputs) {
            const theta = inputs[0]; const phi = inputs[1]; const lambda = inputs[2]; const gamma = inputs[3]
            return [
                [0, 0, 0, 0],
                [0, 0.5 * (Math.sin(gamma) + Math.sin(theta + gamma)), 0, 0],
                [0, 0, 0, 0.5 * (-Math.cos(lambda + gamma) + Math.cos(theta + lambda + gamma))],
                [0, 0.5 * (Math.cos(phi + gamma) - Math.cos(theta + phi + gamma)), 0, 0.5 * (Math.sin(phi + lambda + gamma) + Math.sin(theta + phi + lambda + gamma))]
            ]
        },
        hasReal: true,
        hasImaginary: true,
        size: 2
    },
    CX: {
        real: [
            [1, 0, 0, 0],
            [0, 0, 0, 1],
            [0, 0, 1, 0],
            [0, 1, 0, 0]
        ],
        imaginary: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        hasReal: true,
        hasImaginary: false,
        size: 2
    },
    CY: {
        real: [
            [1, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 0]
        ],
        imaginary: [
            [0, 0, 0, 0],
            [0, 0, 0, -1],
            [0, 0, 0, 0],
            [0, 1, 0, 0]
        ],
        hasReal: true,
        hasImaginary: true,
        size: 2
    },
    CZ: {
        real: [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, -1]
        ],
        imaginary: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        hasReal: true,
        hasImaginary: false,
        size: 2
    },
    CP: {
        real: function CPR(inputs) {
            const lambda = inputs[0]
            return [
                [1, 0, 0, 0],
                [0, 1, 0, 0],
                [0, 0, 1, 0],
                [0, 0, 0, Math.cos(lambda)]
            ]
        },
        imaginary: function CPI(inputs) {
            const lambda = inputs[0]
            return [
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, Math.sin(lambda)]
            ]
        },
        hasReal: true,
        hasImaginary: true,
        size: 2
    },
    CRX: {
        real: function CRXR(inputs) {
            const theta = inputs[0]
            return [
                [1, 0, 0, 0],
                [0, Math.cos(theta / 2), 0, 0],
                [0, 0, 1, 0],
                [0, 0, 0, Math.cos(theta / 2)]
            ]
        },
        imaginary: function CRXI(phase) {
            const theta = inputs[0]
            return [
                [0, 0, 0, 0],
                [0, 0, 0, -Math.sin(theta / 2)],
                [0, 0, 0, 0],
                [0, -Math.sin(theta / 2), 0, 0]
            ]
        },
        hasReal: true,
        hasImaginary: true,
        size: 2
    },
    CRY: {
        real: function CRYR(inputs) {
            const theta = inputs[0]
            return [
                [1, 0, 0, 0],
                [0, Math.cos(theta / 2), 0, -Math.sin(theta / 2)],
                [0, 0, 1, 0],
                [0, Math.sin(theta / 2), 0, Math.cos(theta / 2)]
            ]
        },
        imaginary: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        hasReal: true,
        hasImaginary: false,
        size: 2
    },
    CRZ: {
        real: function CRZR(inputs) {
            const theta = inputs[0]
            return [
                [1, 0, 0, 0],
                [0, Math.cos(-theta / 2), 0, 0],
                [0, 0, 1, 0],
                [0, 0, 0, Math.cos(theta / 2)]
            ]
        },
        imaginary: function CRZI(inputs) {
            const theta = inputs[0]
            return [
                [0, 0, 0, 0],
                [0, Math.sin(-theta / 2), 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, Math.sin(theta / 2)]
            ]
        },
        hasReal: true,
        hasImaginary: true,
        size: 2
    },
    CH: {
        real: [
            [1, Math.SQRT1_2, 0, Math.SQRT1_2],
            [0, 0, 0, 0],
            [0, Math.SQRT1_2, 1, -Math.SQRT1_2],
            [0, 0, 0, 0]
        ],
        imaginary: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        hasReal: true,
        hasImaginary: false,
        size: 2
    },

    // triples
    CCX: {
        real: [
            [1, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 1],
            [0, 0, 0, 0, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 0],
            [0, 0, 0, 1, 0, 0, 0, 0]
        ],
        imaginary: [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0]
        ],
        hasReal: true,
        hasImaginary: false,
        size: 3
    },
    CSWAP: {
        real: [
            [1, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 1, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 1]
        ],
        imaginary: [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0]
        ],
        hasReal: true,
        hasImaginary: false,
        size: 3
    }
}