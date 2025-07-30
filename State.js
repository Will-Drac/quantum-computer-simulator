class State {
    constructor(numQbits) {
        this.substates = []

        for (let i = 0; i < numQbits; i++) {
            this.substates.push(new Substate(1, [i]))
        }
    }

    getQbitFromSubstate(qbit) {
        let substate, localQbitIndex
        for (let i = 0; i < this.substates.length; i++) {
            if (this.substates[i].qbitOrder.includes(qbit)) {
                substate = this.substates[i]
                localQbitIndex = substate.qbitOrder.indexOf(qbit)
            }
        }

        return { substate, localQbitIndex }
    }

    // combines the states containing the qbits into one substate
    // returns the index of the substate that currently hold all the qbits
    async combine(qbits) {
        let substateIndicesToCombine = []

        for (let i = 0; i < qbits.length; i++) {
            for (let j = 0; j < this.substates.length; j++) {
                if (this.substates[j].qbitOrder.includes(qbits[i]) && !substateIndicesToCombine.includes(j)) {
                    substateIndicesToCombine.push(j)
                }
            }
        }

        substateIndicesToCombine = substateIndicesToCombine.sort((a, b) => a - b) //sorts the indices smallest first

        // we're going to add all substates to combine into the first one in the list
        const recipientSubstate = this.substates[substateIndicesToCombine[0]]
        for (let i = 1; i < substateIndicesToCombine.length; i++) {
            const combiningSubstate = this.substates[substateIndicesToCombine[i]]

            // im still not entirely sure that this makes the indices of the qbits match up from the array to the actual state vector
            recipientSubstate.qbitOrder = recipientSubstate.qbitOrder.concat(combiningSubstate.qbitOrder)
            recipientSubstate.numQbits += combiningSubstate.numQbits
            recipientSubstate.vector = await kronecker(combiningSubstate.vector, recipientSubstate.vector)
        }

        // now to remove the substates that just got combined in, going largest to smallest
        for (let i = substateIndicesToCombine.length - 1; i > 0; i--) {
            this.substates.splice(substateIndicesToCombine[i], 1)
        }

        return recipientSubstate
    }

    // removes a qbit from one substate and puts it in its own
    async separate(qbit) {
        const q = this.getQbitFromSubstate(qbit)
        const S = q.substate

        // first, we get the reduced density matrix of just the qbit to separate out of the state
        const rho = await S.getQbitReducedDensityMatrix(q.localQbitIndex)

        // now we need to get the one non-zero eigenvalue of rho
        // ! there's only supposed to be one non-zero eigenvalue as long as the qbit is not entangled, and i'm not sure [0] will always be the non-zero but it seems like it
        const eigenvalueEigenvector = getEigenvaluesEigenvectors2x2(rho)[0]
        const lambda = eigenvalueEigenvector.eigenvalue
        const v = eigenvalueEigenvector.eigenvector

        const s = Math.sqrt(lambda.real)

        // console.log(lambda)

        // now take the vector of this substate, and for each pair of pure states where all qbits are the same except for the one being separated, add together their values weighted by the amplitude of the separated qbit being the value it is in that state (what's stored in the eigenvector), that will be what's left after the separation. finally, dividing by s normalizes it

        const newVector = {
            real: device.createBuffer({
                size: S.vector.real.size / 2,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
            }),
            imag: device.createBuffer({
                size: S.vector.imag.size / 2,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
            })
        }

        const newRows = 2 ** (S.numQbits - 1) //it will now have one less qbit
        const workgroupsPerDimension = Math.ceil(Math.sqrt(newRows))

        // just doing a multiplication of a nx2 matrix and a 2x1 vector => new state vector with qbit removed
        runComputeShader(
            /*wgsl*/ `
            @group(0) @binding(0) var<storage, read> stateReal: array<f32>;
            @group(0) @binding(1) var<storage, read> stateImag: array<f32>;

            @group(0) @binding(2) var<storage, read_write> newStateReal: array<f32>;
            @group(0) @binding(3) var<storage, read_write> newStateImag: array<f32>;

            const eigenvectorReal = vec2f(${v.real[0]}, ${v.real[1]});
            const eigenvectorImag = vec2f(${v.imag[0]}, ${v.imag[1]});

            const twoQbit = ${Math.pow(2, qbit)};

            @compute @workgroup_size(1) fn separateQbit(
                @builtin(global_invocation_id) id: vec3u
            ) {
                let row = id.x * ${workgroupsPerDimension} + id.y;

                if (row < ${newRows}) {
                    let this0StateIndex = row%twoQbit + 2*twoQbit * (row/twoQbit);
                    let this1StateIndex = this0StateIndex + twoQbit;

                    let real0 = eigenvectorReal[0]*stateReal[this0StateIndex] - eigenvectorImag[0]*stateImag[this0StateIndex];
                    let imag0 = eigenvectorReal[0]*stateImag[this0StateIndex] + eigenvectorImag[0]*stateReal[this0StateIndex];

                    let real1 = eigenvectorReal[1]*stateReal[this1StateIndex] - eigenvectorImag[1]*stateImag[this1StateIndex];
                    let imag1 = eigenvectorReal[1]*stateImag[this1StateIndex] + eigenvectorImag[1]*stateReal[this1StateIndex];

                    newStateReal[row] = ${1 / s} * (real0 + real1);
                    newStateImag[row] = ${1 / s} * (imag0 + imag1);
                }
            }
            `,

            [
                { binding: 0, resource: { buffer: S.vector.real } },
                { binding: 1, resource: { buffer: S.vector.imag } },
                { binding: 2, resource: { buffer: newVector.real } },
                { binding: 3, resource: { buffer: newVector.imag } }
            ],

            [workgroupsPerDimension, workgroupsPerDimension, 1]
        )

        // update the state vector and remove the qbit that was separated
        S.vector = newVector
        S.qbitOrder.splice(S.qbitOrder.indexOf(qbit), 1)
        S.numQbits--

        // create a new substate for the qbit
        const separatedSubstate = new Substate(1, [qbit])

        const newSeparatedVector = {
            real: device.createBuffer({
                size: 8,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
                mappedAtCreation: true
            }),
            imag: device.createBuffer({
                size: 8,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
                mappedAtCreation: true
            })
        }

        new Float32Array(newSeparatedVector.real.getMappedRange()).set(new Float32Array([v.real[0], v.real[1]]))
        newSeparatedVector.real.unmap()

        new Float32Array(newSeparatedVector.imag.getMappedRange()).set(new Float32Array([v.imag[0], v.imag[1]]))
        newSeparatedVector.imag.unmap()

        separatedSubstate.vector = newSeparatedVector

        this.substates.push(separatedSubstate)

        return separatedSubstate
    }

    async apply(gateUnitaryOrGPhase, controlQbits, qbitsApplied, inputs, modifiers) {
        const G = gateUnitaryOrGPhase
        if (G.constructor.name == "Gate") {
            await G.applyComponents(this, controlQbits, qbitsApplied, inputs, modifiers)
        }
        else { //it will be a Unitary or GPhase
            // first, we need to combine all the substates which hold the affected qbits into one
            const qbitsAffected = controlQbits.concat(qbitsApplied)
            const substateApplying = await this.combine(qbitsAffected)

            const qbitApplied = qbitsApplied[0] //if this is a unitary, there will be one qbit applied. if a GPhase, there will be none and this will be undefined

            // then the qbits in the substate need to be swapped around so that all the controls are first (starting with most recently applied), then the applied qbit (if it's a Unitary), then no qbits affected for the rest of the substate
            let qbitsCurrentLocations = [] //stores where the affected qbits are currently. the array is ordered so that the controls are first, in order of most recently applied first, then the applied qbit at the end of the array if it exists
            for (let i = controlQbits.length - 1; i >= 0; i--) { //indexing is reversed so that the most recently applied control is first
                qbitsCurrentLocations.push(substateApplying.qbitOrder.indexOf(controlQbits[i]))
            }
            if (G.constructor.name == "Unitary") { qbitsCurrentLocations.push(substateApplying.qbitOrder.indexOf(qbitApplied)) }

            // we want to do swaps of qbit indices in the substate so that the new currentPosition of each affected qbit is equal to its index in the currentPositions array, then it will be in the correct order for a GateMatrix to be applied
            let swaps = []
            for (let i = 0; i < qbitsCurrentLocations.length; i++) {
                if (qbitsCurrentLocations[i] !== i) {
                    swaps.push([qbitsCurrentLocations[i], i])

                    // if we happened to displace another affected qbit, keep track of that
                    for (let j = 0; j < qbitsCurrentLocations.length; j++) {
                        if (qbitsCurrentLocations[j] == i) {
                            qbitsCurrentLocations[j] = i
                            break
                        }
                    }
                }
            }

            // finally, make the swaps in the substate
            await substateApplying.swap(swaps)

            // getting the GateMatrix to apply
            if (!G.gateMatrixUpToDate(substateApplying.numQbits, inputs, modifiers)) {
                await G.getGateMatrix(substateApplying.numQbits, inputs, modifiers)
            }

            // applying it
            const substateRows = 2 ** substateApplying.numQbits
            const workgroupsPerDimension = Math.ceil(Math.sqrt(substateRows))

            const matrixEntriesCode = /*wgsl*/ `
            const matrixEntriesReal = vec4f(${G.modified.real[0][0]}, ${G.modified.real[0][1]}, ${G.modified.real[1][0]}, ${G.modified.real[1][1]});
            const matrixEntriesImag = vec4f(${G.modified.imag[0][0]}, ${G.modified.imag[0][1]}, ${G.modified.imag[1][0]}, ${G.modified.imag[1][1]});
            `

            // for when there's only 1 entries buffer representing either of the columns
            const rowToColCode = /*wgsl*/ `
            const rowToCol = vec2u(${G.gateMatrix.row0Col}, ${G.gateMatrix.row1Col});
            `

            const newStateVector = {
                real: device.createBuffer({
                    size: 4 * substateRows,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
                }),
                imag: device.createBuffer({
                    size: 4 * substateRows,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
                })
            }

            let bindGroupEntries

            if (G.modified.has2ColPerRow) {
                bindGroupEntries = [
                    { binding: 0, resource: { buffer: G.gateMatrix.entries[0] } },
                    { binding: 1, resource: { buffer: G.gateMatrix.entries[1] } }, //the entries from the second column
                    { binding: 2, resource: { buffer: substateApplying.vector.real } },
                    { binding: 3, resource: { buffer: substateApplying.vector.imag } },
                    { binding: 4, resource: { buffer: newStateVector.real } },
                    { binding: 5, resource: { buffer: newStateVector.imag } }
                ]
            }
            else {
                bindGroupEntries = [
                    { binding: 0, resource: { buffer: G.gateMatrix.entries[0] } },
                    { binding: 1, resource: { buffer: substateApplying.vector.real } },
                    { binding: 2, resource: { buffer: substateApplying.vector.imag } },
                    { binding: 3, resource: { buffer: newStateVector.real } },
                    { binding: 4, resource: { buffer: newStateVector.imag } }
                ]
            }

            runComputeShader(
                (await loadWGSL(G.modified.has2ColPerRow ? "shaders/apply2Col.wgsl" : "shaders/apply1Col.wgsl"))
                    .replace("_ENTRIES", matrixEntriesCode)
                    .replace("_ROWCOL", rowToColCode)
                    .replace("_WORKGROUPSPERDIM", workgroupsPerDimension)
                    .replace("_SIZE", substateRows),

                bindGroupEntries,

                [workgroupsPerDimension, workgroupsPerDimension, 1]
            )


            substateApplying.vector = newStateVector
        }
    }

    async measure(qbit) {
        const q = this.getQbitFromSubstate(qbit)
        const S = q.substate

        const measurementResult = await S.measure(q.localQbitIndex)

        // now that this qbit has been measured, its entanglement has surely collapsed, and it can be separated from the rest of the substate
        await this.separate(qbit)

        return measurementResult
    }

    async reset(qbit) {
        const q = this.getQbitFromSubstate(qbit)
        const S = q.substate

        const measurementResult = await S.measure(q.localQbitIndex)

        // if we measured a 1, flip it to be a 0
        if (measurementResult == 1) {
            const X = new Unitary(pi, 0, pi)
            await this.apply(X, [], [qbit], [], [])
        }
    }

    async getQbitInfo(qbit) {
        const q = this.getQbitFromSubstate(qbit)
        const S = q.substate

        return await S.getQbitInfo(q.localQbitIndex)
    }

    // when seeing the results of a circuit, it will be helpful to see the entire state, meaning all substates need to be joined
    async getFullStateVector() {

        // first, we're going to copy the substate at index 0
        const s0 = this.substates[0]

        this.fullState = new Substate(s0.numQbits, s0.qbitOrder)
        this.fullState.vector = { //replacing the vector with one which can be a destination for a copy
            real: device.createBuffer({
                size: this.fullState.vector.real.size,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
            }),
            imag: device.createBuffer({
                size: this.fullState.vector.imag.size,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
            })
        }

        const copyEncoder = device.createCommandEncoder()

        copyEncoder.copyBufferToBuffer(
            s0.vector.real, 0, this.fullState.vector.real, 0, s0.vector.real.size
        )
        copyEncoder.copyBufferToBuffer(
            s0.vector.imag, 0, this.fullState.vector.imag, 0, s0.vector.imag.size
        )

        device.queue.submit([copyEncoder.finish()])

        // then, add on all the other substates with a kronecker product
        for (let i = 1; i < this.substates.length; i++) {
            this.fullState.vector = await kronecker(this.substates[i].vector, this.fullState.vector)
            this.fullState.qbitOrder = this.fullState.qbitOrder.concat(this.substates[i].qbitOrder)
            this.fullState.numQbits += this.substates[i].numQbits
        }

        // finally, the qbit order is not going to be right, we need to sort it and make the necessary swaps

        let o = [] //creating a copy of the qbit order to work on
        for (let i = 0; i < this.fullState.qbitOrder.length; i++) {
            o.push(this.fullState.qbitOrder[i])
        }

        let swaps = []
        for (let i = 0; i < o.length; i++) {
            if (o[i] !== i) { // if the qbit at position i is not qbit i
                const currentPositionI = o.indexOf(i)
                swaps.push([i, currentPositionI]) //swap this position with the position what qbit i is in

                // then update the order to match
                o[currentPositionI] = o[i]
                o[i] = i
            }
        }

        await this.fullState.swap(swaps)

        return this.fullState
    }

    async displayFullState() {
        return await readState(await this.getFullStateVector())
    }
}

// a helper which does the math to combine two substate vectors
async function kronecker(leftVector, rightVector) {
    const newSize = (leftVector.real.size / 4) * (rightVector.real.size / 4)
    const workgroupsPerDimension = Math.ceil(Math.sqrt(newSize))

    const kModule = device.createShaderModule({
        code: (await loadWGSL("shaders/kroneckerVector.wgsl"))
            .replace("_WORKGROUPSPERDIM", workgroupsPerDimension)
            .replace("_NEWSIZE", newSize)
            .replace("_LEFTSIZE", leftVector.real.size / 4)
            .replace("_RIGHTSIZE", rightVector.real.size / 4)
    })

    const kPipeline = device.createComputePipeline({
        layout: "auto",
        compute: { module: kModule }
    })

    const newVector = {}

    newVector.real = device.createBuffer({
        size: newSize * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    })
    newVector.imag = device.createBuffer({
        size: newSize * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    })

    const kBindGroup = device.createBindGroup({
        layout: kPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: leftVector.real } },
            { binding: 1, resource: { buffer: leftVector.imag } },
            { binding: 2, resource: { buffer: rightVector.real } },
            { binding: 3, resource: { buffer: rightVector.imag } },
            { binding: 4, resource: { buffer: newVector.real } },
            { binding: 5, resource: { buffer: newVector.imag } }
        ]
    })

    const kEncoder = device.createCommandEncoder()
    const kPass = kEncoder.beginComputePass()
    kPass.setPipeline(kPipeline)
    kPass.setBindGroup(0, kBindGroup)
    kPass.dispatchWorkgroups(workgroupsPerDimension, workgroupsPerDimension, 1)
    kPass.end()

    device.queue.submit([kEncoder.finish()])

    return newVector
}