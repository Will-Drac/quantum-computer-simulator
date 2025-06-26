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

    // let state = new State(3)

    // let G = new Gate("GPHASE", [3*Math.PI/4])

    // G = await G.addControl()
    // G = await G.addNegativeControl()

    // const SM = await G.getStateMatrixGPhase(3, [2, 1])

    // state = await (new Gate("X")).apply(state, [1])
    // state = await (new Gate("X")).apply(state, [0])

    // state = await G.apply(state, [2, 1])


    // console.log(await state.vector.real.getEntries(), await state.vector.imaginary.getEntries())
    // console.log(await state.getProbabilities())


    let A = new Gate("H")
    // A = await A.addControl()
    // A = await A.addNegativeControl()
    console.log(await (await A.getStateMatrix(6, 0)).real.getEntries())
}

main()

/*

*/