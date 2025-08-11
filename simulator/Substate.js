// qbit indices used here are the local qbit indices (going from 0 to numQbits) and not the indices from the State, which may be anything depending on how substates share qbits

class Substate {
    constructor(numQbits, qbitOrder) {
        this.numQbits = numQbits
        this.qbitOrder = qbitOrder
        this.vector = {}

        // the vector will start off as [1, 0, 0, ...]
        this.vector.real = device.createBuffer({
            size: 4 * 2 ** numQbits,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true
        })
        new Float32Array(this.vector.real.getMappedRange()).set(new Float32Array([1]))
        this.vector.real.unmap()

        this.vector.imag = device.createBuffer({
            size: 4 * 2 ** numQbits,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        })
    }

    async swap(qbitSwaps) { //qbitSwaps will hold a list of all swaps the make in order eg. [[0, 1], [0, 2]] 012 -> 201
        if (qbitSwaps.length == 0) { return }

        const size = this.vector.real.size
        const workgroupsPerDimension = Math.ceil(Math.sqrt(size))

        let swapCode = `const swaps: array<vec2u, ${qbitSwaps.length}> = array<vec2u, ${qbitSwaps.length}>(`
        for (let i = 0; i < qbitSwaps.length; i++) {
            swapCode += `vec2u(${qbitSwaps[i][0]}, ${qbitSwaps[i][1]}), `
        }
        swapCode += ");"

        const newReal = device.createBuffer({
            size: this.vector.real.size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        })
        const newImag = device.createBuffer({
            size: this.vector.imag.size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        })

        runComputeShader(
            (await loadWGSL("./simulator/shaders/stateQbitSwap.wgsl"))
                .replace("_SIZE", size)
                .replace("_WORKGROUPSPERDIM", workgroupsPerDimension)
                .replace("_SWAPS", swapCode)
                .replaceAll("_NUMSWAPS", qbitSwaps.length),

            [
                { binding: 0, resource: { buffer: this.vector.real } },
                { binding: 1, resource: { buffer: this.vector.imag } },
                { binding: 2, resource: { buffer: newReal } },
                { binding: 3, resource: { buffer: newImag } },
            ],

            [workgroupsPerDimension, workgroupsPerDimension, 1]
        )

        this.vector.real = newReal
        this.vector.imag = newImag

        // we need to also perform the swaps in qbitOrder
        for (let i = 0; i < qbitSwaps.length; i++) {
            const swap0 = qbitSwaps[i][0]
            const swap1 = qbitSwaps[i][1]

            const temp = this.qbitOrder[swap0]
            this.qbitOrder[swap0] = this.qbitOrder[swap1]
            this.qbitOrder[swap1] = temp
        }
    }

    async getProbabilities() {
        const size = this.vector.real.size
        const workgroupsPerDimension = Math.ceil(Math.sqrt(size))

        this.probabilities = device.createBuffer({
            size: this.vector.real.size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        })

        runComputeShader(
            (await loadWGSL("./simulator/shaders/stateProbabilities.wgsl"))
                .replace("_SIZE", size)
                .replace("_WORKGROUPSPERDIM", workgroupsPerDimension),

            [
                { binding: 0, resource: { buffer: this.vector.real } },
                { binding: 1, resource: { buffer: this.vector.imag } },
                { binding: 2, resource: { buffer: this.probabilities } },
            ],

            [workgroupsPerDimension, workgroupsPerDimension, 1]
        )
    }

    // probability1 = 1-probability0
    async getQbitProbability0(qbit) {
        await this.getProbabilities()

        const numRows = (2 ** this.numQbits) / 2 //removing half the probabilities

        // first, we remove all the probabilities of the states where the qbit isn't 0
        // then, we add up all the remaining probabilities using gpu reduction

        const pruneWorkgroupsPerDimension = Math.ceil(Math.sqrt(numRows))

        const prunedBuffer = device.createBuffer({
            size: this.probabilities.size / 2,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        })

        runComputeShader(
            (await loadWGSL("./simulator/shaders/pruneProbabilities.wgsl"))
                .replace("_SIZE", numRows)
                .replace("_WORKGROUPSPERDIM", pruneWorkgroupsPerDimension)
                .replace("_QBIT", qbit),

            [
                { binding: 0, resource: { buffer: this.probabilities } },
                { binding: 1, resource: { buffer: prunedBuffer } }
            ],

            [pruneWorkgroupsPerDimension, pruneWorkgroupsPerDimension, 1]
        )

        // now doing the reduction

        return await sumBuffer(prunedBuffer)
    }

    // measures a qbit to 0 or 1 and collapses part of the state
    async measure(qbit, result) {
        const probabilityToMeasure0 = await this.getQbitProbability0(qbit)
        const measurementResult = result < probabilityToMeasure0 ? 0 : 1

        // now to collapse
        const numRows = 2 ** this.numQbits
        const workgroupsPerDimension = Math.ceil(Math.sqrt(numRows))

        runComputeShader(
            (await loadWGSL("./simulator/shaders/collapseState.wgsl"))
                .replace("_SIZE", numRows)
                .replace("_WORKGROUPSPERDIM", workgroupsPerDimension)
                .replace("_QBIT", qbit)
                .replace("_MEASUREMENT", measurementResult)
                .replace("_MEASUREMENTPROB", measurementResult == 0 ? probabilityToMeasure0 : 1 - probabilityToMeasure0),

            [
                { binding: 0, resource: { buffer: this.vector.real } },
                { binding: 1, resource: { buffer: this.vector.imag } }
            ],

            [workgroupsPerDimension, workgroupsPerDimension, 1]
        )

        return measurementResult
    }

    // gets the reduced density matrix of the selected qbit out of the overall state, used to get bloch sphere position and to remove this qbit from the state
    async getQbitReducedDensityMatrix(qbit) {
        // if there's only one qbit in this substate, getting the density matrix is very efficient on the cpu
        if (this.numQbits == 1) {
            const readBufferReal = device.createBuffer({
                size: this.vector.real.size,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            })
            const readBufferImag = device.createBuffer({
                size: this.vector.imag.size,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            })

            const readEncoder = device.createCommandEncoder()
            readEncoder.copyBufferToBuffer(
                this.vector.real, 0, readBufferReal, 0, readBufferReal.size
            )
            readEncoder.copyBufferToBuffer(
                this.vector.imag, 0, readBufferImag, 0, readBufferImag.size
            )

            device.queue.submit([readEncoder.finish()])

            await readBufferReal.mapAsync(GPUMapMode.READ)
            const vectorReal = new Float32Array(readBufferReal.getMappedRange())

            await readBufferImag.mapAsync(GPUMapMode.READ)
            const vectorImag = new Float32Array(readBufferImag.getMappedRange())

            return {
                real: [
                    [vectorReal[0] ** 2 + vectorImag[0] ** 2, vectorReal[0] * vectorReal[1] + vectorImag[0] * vectorImag[1]],
                    [vectorReal[0] * vectorReal[1] + vectorImag[0] * vectorImag[1], vectorReal[1] ** 2 + vectorImag[1] ** 2]
                ],

                imag: [
                    [0, vectorReal[1] * vectorImag[0] - vectorImag[1] * vectorReal[0]],
                    [vectorImag[1] * vectorReal[0] - vectorReal[1] * vectorImag[0], 0]
                ]
            }
        }

        const prob0 = await this.getQbitProbability0(qbit)

        // now, we need to get the coherence between |0> and |1>
        // to do that, we calculate all the needed elements from the state's full density matrix, put them into a buffer, and do a gpu reduction to add them all up

        const elementsWorkgroupsPerDimension = Math.ceil(Math.sqrt(2 ** (this.numQbits - 1)))

        const elementsBufferReal = device.createBuffer({
            size: 4 * 2 ** (this.numQbits - 1), //there will be half as many elements as entries in the state vector
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        })
        const elementsBufferImag = device.createBuffer({
            size: 4 * 2 ** (this.numQbits - 1), //there will be half as many elements as entries in the state vector
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        })

        runComputeShader(
            (await loadWGSL("./simulator/shaders/densityMatrixCoherenceElements.wgsl"))
                .replace("_SIZE", 2 ** (this.numQbits - 1))
                .replace("_WORKGROUPSPERDIM", elementsWorkgroupsPerDimension)
                .replace("_QBIT", qbit),

            [
                { binding: 0, resource: { buffer: this.vector.real } },
                { binding: 1, resource: { buffer: this.vector.imag } },
                { binding: 2, resource: { buffer: elementsBufferReal } },
                { binding: 3, resource: { buffer: elementsBufferImag } },
            ],

            [elementsWorkgroupsPerDimension, elementsWorkgroupsPerDimension, 1]
        )

        // now the elements buffer needs to be summed down to one number
        const coherence01 = { real: await sumBuffer(elementsBufferReal), imag: await sumBuffer(elementsBufferImag) }

        return {
            real: [
                [prob0, coherence01.real],
                [coherence01.real, 1 - prob0]
            ],
            imag: [
                [0, coherence01.imag],
                [-coherence01.imag, 0]
            ]
        }
    }

    // extracts all useful information of a single qbit in this state: bloch sphere position, phase, probability, purity of reduced state
    async getQbitInfo(qbit) {
        const rho = await this.getQbitReducedDensityMatrix(qbit)

        // finally, we can get the bloch sphere position
        const x = 2 * rho.real[0][1]
        const y = -2 * rho.imag[0][1]
        const z = 2 * rho.real[0][0] - 1

        const radius = Math.sqrt(x ** 2 + y ** 2 + z ** 2)
        const phase = Math.atan2(y, x)

        const probabilityAngle = Math.atan2(Math.sqrt(x * x + y * y), z)

        return { position: { x, y, z }, radius, purity: 0.5 * (1 + radius ** 2), phase, probability0: rho.real[0][0], probabilityAngle }
    }
}