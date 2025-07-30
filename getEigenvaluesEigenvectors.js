function getEigenvaluesEigenvectors2x2(complexMatrix) {
    const real = complexMatrix.real
    const imag = complexMatrix.imag

    const tr = real[0][0] + real[1][1]
    const ti = imag[0][0] + imag[1][1]

    const dr = real[0][0] * real[1][1] - imag[0][0] * imag[1][1] - real[1][0] * real[0][1] + imag[1][0] * imag[0][1]
    const di = real[0][0] * imag[1][1] + imag[0][0] * real[1][1] - real[1][0] * imag[0][1] - imag[1][0] * real[0][1]

    const Dr = tr ** 2 - ti ** 2 - 4 * dr
    const Di = 2 * tr * ti - 4 * di

    const R = Math.sqrt(Dr ** 2 + Di ** 2)

    const sr = Math.sqrt((R + Dr) / 2)
    const si = (Di == 0 ? 1 : Math.sign(Di)) * Math.sqrt((R - Dr) / 2)

    // the eigenvalues
    const lambda1r = (tr + sr) / 2
    const lambda1i = (ti + si) / 2

    const lambda2r = (tr - sr) / 2
    const lambda2i = (ti - si) / 2

    // finding eigenvectors
    // solutions to (A - lambda I) v = 0  let B = (A - lambda I) for both lambda

    const B1r = [
        [real[0][0] - lambda1r, real[0][1]],
        [real[1][0], real[1][1] - lambda1r]
    ]
    const B1i = [
        [imag[0][0] - lambda1i, imag[0][1]],
        [imag[1][0], imag[1][1] - lambda1i]
    ]

    const B2r = [
        [real[0][0] - lambda2r, real[0][1]],
        [real[1][0], real[1][1] - lambda2r]
    ]
    const B2i = [
        [imag[0][0] - lambda2i, imag[0][1]],
        [imag[1][0], imag[1][1] - lambda2i]
    ]

    // finding a solution for B1 and B2

    function getNullSolutions(Mr, Mi) {
        if (Mr[0][0] == 0 && Mi[0][0] == 0) {
            if (Mr[1][0] == 0 && Mi[1][0] == 0) {
                /*
                0 a => [anything, 0], choose [1, 0]
                0 b
                */
                return { real: [1, 0], imag: [0, 0] }
            }
            else {
                /*
                0 a? => swap rows
                c d?
                */
                Mr[0][0] = Mr[1][0]; Mr[0][1] = Mr[1][1]
                Mi[0][0] = Mi[1][0]; Mi[0][1] = Mi[1][1]
            }
        }

        /*
        a  b?
        c? d?
        */

        if (Mr[1][0] !== 0 || Mi[1][0] !== 0) {
            // R2 = R2 - c/a R1
            // but |M| = 0 => b - cd/a = 0 so the second row becomes 0
            Mr[1][0] = 0; Mi[1][0] = 0; Mr[1][1] = 0; Mi[1][1] = 0
        }
        /* else
            a b? => a b?  b/c  ad - bc = 0
            0 d?    0 0
        */

        if (Mr[0][1] == 0 && Mi[0][1] == 0) {
            /*
            a 0 => [0, anything] choose [0, 1]
            0 0
            */
            return { real: [0, 1], imag: [0, 0] }
        }
        else {
            /*
            a b => ax + by = 0 => choose y = 1 => x = -b/a
            0 0
            */
            const ar = Mr[0][0]; const ai = Mi[0][0]
            const br = Mr[0][1]; const bi = Mi[0][1]
            const d = ar ** 2 + ai ** 2
            return { real: [-(ar * br + ai * bi) / d, 1], imag: [(ai * br - ar * bi) / d, 0] }
        }
    }

    const v1 = getNullSolutions(B1r, B1i)
    const v2 = getNullSolutions(B2r, B2i)

    // normalizing the eigenvectors
    const v1L = Math.sqrt(v1.real[0] ** 2 + v1.real[1] ** 2 + v1.imag[0] ** 2 + v1.imag[1] ** 2)
    const v2L = Math.sqrt(v2.real[0] ** 2 + v2.real[1] ** 2 + v2.imag[0] ** 2 + v2.imag[1] ** 2)

    v1.real[0] = v1.real[0] / v1L; v1.imag[0] = v1.imag[0] / v1L
    v1.real[1] = v1.real[1] / v1L; v1.imag[1] = v1.imag[1] / v1L

    v2.real[0] = v2.real[0] / v2L; v2.imag[0] = v2.imag[0] / v2L
    v2.real[1] = v2.real[1] / v2L; v2.imag[1] = v2.imag[1] / v2L

    return [
        { eigenvalue: { real: lambda1r, imag: lambda1i }, eigenvector: v1 },
        { eigenvalue: { real: lambda2r, imag: lambda2i }, eigenvector: v2 }
    ]
}