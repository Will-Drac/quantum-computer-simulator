let adapter, device

async function loadWGSL(url) {
    const resp = await fetch(url)
    return await resp.text()
}

async function main() {
    adapter = await navigator.gpu?.requestAdapter()
    device = await adapter?.requestDevice()
    if (!device) {
        alert("need a browser that supports WebGPU")
        return
    }

    // let state = new State(12)

    // const H = new SingleGate("H")
    // state = await H.apply(state, 1)

    // const P = new SingleGate("P", Math.PI/2)
    // state = await P.apply(state, 1)

    // const SX = new SingleGate("SX")
    // state = await SX.apply(state, 1)

    // console.log(await state.getProbabilities())



    let state = new State(10)
    let controlledGate = new Gate("X")

    state = await (new Gate("H")).apply(state, [0])

    for (let i = 0; i < 9; i++) {
        // state = await (new Gate("H")).apply(state, [i])

        controlledGate = await controlledGate.addNegativeControl()
    }

    state = await controlledGate.apply(state, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])


    console.log(await state.vector.real.getEntries(), await state.vector.imaginary.getEntries())
    console.log(await state.getProbabilities())
}

main()

/*

*/