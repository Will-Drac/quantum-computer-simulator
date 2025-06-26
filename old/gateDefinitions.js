const GateDefinitions = {
    // singles
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
        size: 1,
        controls: []
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
        size: 1,
        controls: []
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
        size: 1,
        controls: []
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
        size: 1,
        controls: []
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
        size: 1,
        controls: []
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
        size: 1,
        controls: []
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
        size: 1,
        controls: []
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
        size: 1,
        controls: []
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
        size: 1,
        controls: []
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
        size: 1,
        controls: []
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
        size: 1,
        controls: []
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
        size: 1,
        controls: []
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
        size: 1,
        controls: []
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
        size: 1,
        controls: []
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
        size: 1,
        controls: []
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
        size: 2,
        controls: ["pos"]
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
        size: 2,
        controls: ["pos"]
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
        size: 2,
        controls: ["pos"]
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
        size: 2,
        controls: ["pos"]
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
        size: 2,
        controls: ["pos"]
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
        size: 2,
        controls: ["pos"]
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
        size: 2,
        controls: ["pos"]
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
        size: 2,
        controls: ["pos"]
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
        size: 2,
        controls: ["pos"]
    },
    SWAP: {
        real: [
            [1, 0, 0, 0],
            [0, 0, 1, 0],
            [0, 1, 0, 0],
            [0, 0, 0, 1]
        ],
        imaginary: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        hasReal: true,
        hasImaginary: false,
        size: 2,
        controls: []
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
        size: 3,
        controls: ["pos", "pos"]
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
        size: 3,
        controls: ["pos"]
    }
}

// ! i think all gates that aren't singles will need to be composed of only controlled single gates so that i can inverse and exponentiate