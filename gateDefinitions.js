const GateDefinitions = {
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
        hasImaginary: false
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
        hasImaginary: false
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
        hasImaginary: true
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
        hasImaginary: false
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
        hasImaginary: false
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
        hasImaginary: true
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
        hasImaginary: true
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
        hasImaginary: true
    },

    SWAP: {
        real: [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 0, 1],
            [0, 0, 1, 0]
        ],
        imaginary: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        hasReal: true,
        hasImaginary: false
    }
}