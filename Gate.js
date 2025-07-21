class Gate {
    constructor(components) { //components is an array of GateComponent
        this.components = components //the array is in the order of application

        this.numQbitsApplied = 0
        this.numInputs = 0
        this.numControls = 0 //a Gate can have controls without having any modifiers applied to itself, so we need to keep track of that

        for (let i = 0; i < components.length; i++) {
            this.numQbitsApplied += components[i].effect.numQbitsApplied
            this.numInputs += components[i].effect.numInputs
            this.numControls += components[i].getNumControls()
        }
    }

    addComponent(component) {
        // a component is either a Unitary, a GPhase, or another Gate
        this.components.push(component)

        this.numQbitsApplied += component.effect.numQbitsApplied
        this.numInputs += component.effect.numInputs
        this.numControls += component.getNumControls()
    }

    async apply(state, controlQbits, qbitsApplied, inputs, modifiers) {
        // about modifiers:
        // remove all power and inverse modifiers and apply this gate multiple times or flip is components accordingly
        // pool together all controls and pass them down to the components as modifiers
        let totalPower = 1
        let passedDownControls = []
        for (let i = 0; i < modifiers.length; i++) {
            const type = modifiers[i].type
            if (type == "inverse") { totalPower *= -1 }
            else if (type == "power") { totalPower *= modifiers[i].value }
            else if (type == "control" || type == "negativeControl") { passedDownControls.push(modifiers[i]) }
        }

        if (totalPower !== Math.floor(totalPower)) { console.log("ERROR: tried applying a float-valued power to a gate: " + totalPower, this) }

        // these qbit indices get passed to all components, since the controls on this Gate are applied to its components as modifiers
        let passedDownQbits = []
        for (let i = controlQbits.length - passedDownControls.length; i < controlQbits.length; i++) {
            passedDownQbits.push(controlQbits[i])
        }

        let applyingInverse = false //if the exponent was negative, we need to apply the components in reverse, and add an inverse modifier to them
        if (totalPower < 0) {
            totalPower *= -1
            applyingInverse = true
        }

        // we repeat application of all components according to the power this gate was raised to
        for (let repetition = 0; repetition < totalPower; repetition++) {

            let currentControlsIndex = 0
            let currentQbitsAppliedIndex = 0
            let currentInputsIndex = 0
            for (let k = 0; k < this.components.length; k++) {
                const i = applyingInverse ? this.components.length - k - 1 : k // if we're applying the inverse, we go through the components last to first

                const c = this.components[i].effect

                const cNumControls = this.components[i].getNumControls()

                let cModifiers = []
                for (let l = 0; l < this.components[i].modifiers.length; l++) {
                    cModifiers.push(this.components[i].modifiers[l])
                }
                for (let l = 0; l < passedDownControls.length; l++) {
                    cModifiers.push(passedDownControls[l])
                }
                if (applyingInverse) { cModifiers.push(new Modifier("inverse")) }

                const type = c.constructor.name

                if (type == "Gate") {
                    let thisControlQbits = []
                    for (let j = 0; j < cNumControls; j++) {
                        thisControlQbits.push(controlQbits[currentControlsIndex])
                        currentControlsIndex++
                    }
                    thisControlQbits = thisControlQbits.concat(passedDownQbits)

                    let thisInputs = []
                    for (let j = 0; j < c.numInputs; j++) {
                        thisInputs.push(inputs[currentInputsIndex])
                        currentInputsIndex++
                    }

                    let thisQbitsApplied = []
                    for (let j = 0; j < c.numQbitsApplied; j++) {
                        thisQbitsApplied.push(qbitsApplied[currentQbitsAppliedIndex])
                        currentQbitsAppliedIndex++
                    }

                    await c.apply(state, thisControlQbits, thisQbitsApplied, thisInputs, cModifiers)
                }

                else if (type == "Unitary") {
                    let thisControlQbits = []
                    for (let j = 0; j < cNumControls; j++) {
                        thisControlQbits.push(controlQbits[currentControlsIndex])
                        currentControlsIndex++
                    }
                    thisControlQbits= thisControlQbits.concat(passedDownQbits)

                    let thisInputs = []
                    for (let j = 0; j < c.numInputs; j++) {
                        thisInputs.push(inputs[currentInputsIndex])
                        currentInputsIndex++
                    }

                    const qbitApplied = qbitsApplied[currentQbitsAppliedIndex]
                    currentQbitsAppliedIndex++

                    await c.apply(state, thisControlQbits, qbitApplied, thisInputs, cModifiers)
                }

                else if (type == "GPhase") {
                    let thisControlQbits = []
                    for (let j = 0; j < cNumControls; j++) {
                        thisControlQbits.push(controlQbits[currentControlsIndex])
                        currentControlsIndex++
                    }
                    thisControlQbits= thisControlQbits.concat(passedDownQbits)

                    let thisInputs = []
                    for (let j = 0; j < c.numInputs; j++) {
                        thisInputs.push(inputs[currentInputsIndex])
                        currentInputsIndex++
                    }

                    await c.apply(state, thisControlQbits, thisInputs, cModifiers)
                }
            }

        }
    }
}

// i think we just dont allow float-powers of a composite matrix