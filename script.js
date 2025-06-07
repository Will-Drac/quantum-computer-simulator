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

    const A = new ComplexMatrix(2, 2)
    A.real.entries = [
        [0, 1],
        [2, 1]
    ]
    A.real.getTexture()
    A.imaginary.entries = [
        [1, 1],
        [1, 2]
    ]
    A.imaginary.getTexture()

    const B = new ComplexMatrix(2, 2)
    B.real.entries = [
        [1, 2],
        [1, 0]
    ]
    B.real.getTexture()
    B.imaginary.entries = [
        [0, 0],
        [1, 0]
    ]
    B.imaginary.getTexture()

    const result = await A.kronecker(B)
    console.log(await result.real.getEntries(), await result.imaginary.getEntries())
}

main()

/*

*/