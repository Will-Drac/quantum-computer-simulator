let adapter, device

async function loadWGSL(url) {
    const resp = await fetch(url)
    return await resp.text()
}

async function main() {
    adapter = await navigator.gpu?.requestAdapter()
    const { maxBufferSize, maxStorageBufferBindingSize } = adapter.limits
    device = await adapter?.requestDevice({
        requiredLimits: {
            maxStorageBufferBindingSize,
            maxBufferSize
        }
    })

    if (!device) {
        alert("need a browser that supports WebGPU")
        return
    }

    // !max column that can be stored is 2^30, so max 30 qbits
    console.log(`${Math.floor(Math.log2(maxStorageBufferBindingSize / 4))} qbits are possible on this device`)

    let state = new State(3)

    const X = new Unitary(Math.PI, 0, Math.PI)
    const H = new Unitary(Math.PI / 2, 0, 0)

    await H.apply(state, [], 0)

    const C1 = new Unitary(Math.PI/2, Math.PI/2, Math.PI/2)
    await C1.apply(state, [], 1)

    const C2 = new Unitary(Math.PI/3, Math.PI/6, Math.PI/2)
    C2.modify(new Modifier("control"))

    await C2.apply(state, [1], 2)

    console.log(await state.reset(2))

    console.log(await readState(state))

    // console.log(await state.getQbitProbability0(4))
}
main()

// coming out of some of the computations, some numbers that should be 0 turn out to be stored as a tiny number, this adds a buffer for x == 0
function equals0(value) {
    return Math.abs(value) < 1e-10
}

function correct0Precision(value) {
    return Math.abs(value) < 1e-10 ? 0 : value
}

// helper function
async function readGateMatrix(buffer) {
    const readBuffer = device.createBuffer({
        size: buffer.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    })

    const readEncoder = device.createCommandEncoder()
    readEncoder.copyBufferToBuffer(
        buffer, 0, readBuffer, 0, buffer.size
    )

    device.queue.submit([readEncoder.finish()])

    await readBuffer.mapAsync(GPUMapMode.READ)
    const result = new Uint32Array(readBuffer.getMappedRange())

    let data = []
    for (let i = 0; i < result.length; i++) {
        const is1 = result[i] >> 31 == -1
        const rowOfOriginal = result[i] >> 30 & 1
        const column = result[i] & 0x3FFFFFF

        data.push({ is1, rowOfOriginal, column })
    }

    return data
}

async function displayMatrix(gateMatrix) {
    const matrix = new Array(2 ** gateMatrix.numQbits).fill(null).map(() => new Array(2 ** gateMatrix.numQbits).fill("0.00+0.00i"))

    if (gateMatrix.unitary.modified.has2ColPerRow) {
        const data = [await readGateMatrix(gateMatrix.entries[0]), await readGateMatrix(gateMatrix.entries[1])]
        for (let i = 0; i < data[0].length; i++) {
            for (let j = 0; j < 2; j++) {
                const d = data[j][i]
                if (d.is1) {
                    matrix[i][d.column] = `1.00+0.00i`
                }
                else {
                    const entryReal = gateMatrix.unitary.modified.real[d.rowOfOriginal][j]
                    const entryImag = gateMatrix.unitary.modified.imag[d.rowOfOriginal][j]

                    matrix[i][d.column] = `${entryReal.toFixed(2)}+${entryImag.toFixed(2)}i`
                }
            }
        }
    }
    else {
        const data = await readGateMatrix(gateMatrix.entries[0])
        for (let i = 0; i < data.length; i++) {
            const d = data[i]
            if (d.is1) {
                matrix[i][d.column] = `1.00+0.00i`
            }
            else {
                const rowToCol = [gateMatrix.row0Col, gateMatrix.row1Col]
                const entryReal = gateMatrix.unitary.modified.real[d.rowOfOriginal][rowToCol[d.rowOfOriginal]]
                const entryImag = gateMatrix.unitary.modified.imag[d.rowOfOriginal][rowToCol[d.rowOfOriginal]]

                matrix[i][d.column] = `${entryReal.toFixed(2)}+${entryImag.toFixed(2)}i`
            }
        }
    }

    return matrix
}

async function readState(state) {
    await state.getProbabilities()

    const readBufferReal = device.createBuffer({
        size: state.vector.real.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    })
    const readBufferImag = device.createBuffer({
        size: state.vector.imag.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    })
    const readBufferProb = device.createBuffer({
        size: state.probabilities.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    })

    const readEncoder = device.createCommandEncoder()
    readEncoder.copyBufferToBuffer(
        state.vector.real, 0, readBufferReal, 0, readBufferReal.size
    )
    readEncoder.copyBufferToBuffer(
        state.vector.imag, 0, readBufferImag, 0, readBufferImag.size
    )
    readEncoder.copyBufferToBuffer(
        state.probabilities, 0, readBufferProb, 0, readBufferProb.size
    )

    device.queue.submit([readEncoder.finish()])

    await readBufferReal.mapAsync(GPUMapMode.READ)
    const resultReal = new Float32Array(readBufferReal.getMappedRange())

    await readBufferImag.mapAsync(GPUMapMode.READ)
    const resultImag = new Float32Array(readBufferImag.getMappedRange())

    await readBufferProb.mapAsync(GPUMapMode.READ)
    const resultProb = new Float32Array(readBufferProb.getMappedRange())

    return { real: resultReal, imag: resultImag, prob: resultProb }
}