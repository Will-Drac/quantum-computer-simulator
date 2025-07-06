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

    console.log(`${Math.floor(Math.log2(maxStorageBufferBindingSize/4))} qbits are possible on this device`)

    let u = new Unitary(0, 0, Math.PI)

    let m = new GateMatrix(u, 16, [], 2)
    await m.create()
    console.log(await readGateMatrix(m.entries[0]))
}

main()

// coming out of some of the computations, some numbers that should be 0 turn out to be stored as a tiny number, this adds a buffer for x == 0
function equals0(value){
    return Math.abs(value) < 1e-10
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
        const is1 = result[i] >> 31 == 1
        const rowOfOriginal = result[i] >> 30 & 1
        const column = result[i] & 0x3FFFFFF

        data.push({is1, rowOfOriginal, column})
    }

    return data
}


/*

*/