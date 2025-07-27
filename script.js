const pi = Math.PI

// sin and cos have some precision issues, so i'm manually correcting them at some important angles
function sin(theta) {
    switch (theta) {
        case pi / 6:
            return 0.5
        case pi / 4:
            return Math.SQRT1_2
        case pi:
            return 0
        default:
            return Math.sin(theta)
    }
}

function cos(theta) {
    return sin(theta + pi / 2)
}

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
    console.log(`${Math.floor(Math.log2(maxStorageBufferBindingSize / 4))} entangled qbits are possible on this device`)


    const numQbits = 3

    let state = new State(numQbits)

    const X = new Unitary(pi, 0, pi)
    const H = new Unitary(pi / 2, 0, 0)
    const RY = new Unitary([0, function (v) { return v }], 0, 0)
    const RZ = new Unitary(0, [0, function(v){return v}], 0)

    const CX = new Gate([new GateComponent(X, [new Modifier("control")])])
    const CRY = new Gate([new GateComponent(RY, [new Modifier("control")])])
    const CRY4 = new Gate([new GateComponent(CRY, [new Modifier("power", 4)])])

    const PHASE = new GPhase([0, function (phase) { return phase }])

    const CPHASE = new Gate([new GateComponent(PHASE, [new Modifier("negativeControl")])])

    // for (let i = 0; i < numQbits; i+=2) {
    //     await H.apply(state, [], i, [], [])
    //     await CX.apply(state, [i], [i+1], [], [])
    // }

    await RY.apply(state, [], 1, [pi/3], [])

    // let measurements = []
    // for (let i = 0; i < numQbits; i++) {
    //     measurements.push(await state.measure(i))
    // }
    // console.log(measurements)

    console.log(await state.measure(1))
    console.log(await readState(state))
}
main()

// coming out of some of the computations, some numbers that should be 0 turn out to be stored as a tiny number, this adds a buffer for x == 0
function equals0(value) {
    return Math.abs(value) < 1e-10
}

function correct0Precision(value) {
    return Math.abs(value) < 1e-10 ? 0 : value
}

async function sumBuffer(buffer) {
    const numElements = buffer.size / 4

    const rModule = device.createShaderModule({
        code: await loadWGSL("shaders/reduce.wgsl")
    })

    const rPipeline = device.createComputePipeline({
        layout: "auto",
        compute: {
            module: rModule
        }
    })

    const workBuffer = device.createBuffer({
        size: buffer.size,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    })

    const copyEncoder = device.createCommandEncoder()
    copyEncoder.copyBufferToBuffer(
        buffer, 0, workBuffer, 0, workBuffer.size
    )
    device.queue.submit([copyEncoder.finish()])

    const rUniformBuffer = device.createBuffer({
        size: 8,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })

    const rBindGroup = device.createBindGroup({
        layout: rPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: workBuffer } },
            { binding: 1, resource: { buffer: rUniformBuffer } }
        ]
    })

    const numSteps = Math.ceil(Math.log2(numElements))
    for (let i = 0; i < numSteps; i++) {
        const thisReduceEncoder = device.createCommandEncoder()
        const thisPass = thisReduceEncoder.beginComputePass()

        const stride = 2 ** i// a stride of 1 means no entries are skipped and each pair is added, so it takes rows/2 workgroups. if stride is 2, every second entry is ignored and it takes rows/4 workgroups
        const workgroupsPerDimension = Math.ceil(Math.sqrt(numElements / (2 * stride)))

        const rUniforms = new Uint32Array(2)
        rUniforms.set([stride, workgroupsPerDimension])

        device.queue.writeBuffer(rUniformBuffer, 0, rUniforms)

        thisPass.setPipeline(rPipeline)
        thisPass.setBindGroup(0, rBindGroup)
        thisPass.dispatchWorkgroups(workgroupsPerDimension, workgroupsPerDimension, 1)

        thisPass.end()

        device.queue.submit([thisReduceEncoder.finish()])
    }

    // now workBuffer has the probability of the selected qbit in its first entry
    const readBuffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    })

    const readEncoder = device.createCommandEncoder()
    readEncoder.copyBufferToBuffer(
        workBuffer, 0, readBuffer, 0, 4
    )
    device.queue.submit([readEncoder.finish()])

    await readBuffer.mapAsync(GPUMapMode.READ)

    return (new Float32Array(readBuffer.getMappedRange()))[0]
}

// helper function for debugging
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