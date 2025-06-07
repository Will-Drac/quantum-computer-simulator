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


    // let a1 = new Matrix(20, 20)
    // let a2 = new Matrix(20, 20)
    // for (let i = 0; i < 20; i++) {
    //     for (let j = 0; j < 20; j++) {
    //         const v = Math.random()
    //         a1.entries[i][j] = v
    //         a2.entries[i][j] = -v
    //     }
    // }
    // a1.getTexture()
    // a2.getTexture()

    // let b = new Matrix(20, 20)
    // for (let i = 0; i < 20; i++) {
    //     b.entries[i][i] = 2
    // }
    // b.getTexture()

    // for (let i = 0; i < 100; i++) {
    //     const ba1 = await b.matrixTexture.multiply(a1.matrixTexture)
    //     const ba2 = await b.matrixTexture.multiply(a2.matrixTexture)

    //     const sum = await ba1.add(ba2)

    //     console.log(await sum.getMatrix())
    // }

    const A = new ComplexMatrix(3, 3)
    A.real.entries = [
        [1, 6, 0],
        [1, 0, 0],
        [1, 0, 1]
    ]
    A.imaginary.entries = [
        [1, 1, 5],
        [0, 1, 0],
        [6, 0, 0]
    ]
    A.real.getTexture()
    A.imaginary.getTexture()

    const v = new ComplexVector(3)
    v.real.entries = [
        1, 2, 0
    ]
    v.imaginary.entries = [
        1, 0, 7
    ]
    v.real.getTexture()
    v.imaginary.getTexture()

    const result = await A.multiplyComplexVector(v)

    console.log(await result.real.getEntries(), await result.imaginary.getEntries())
}

main()

/*

*/