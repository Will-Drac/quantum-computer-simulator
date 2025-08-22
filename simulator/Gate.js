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

    async applyComponents(state, controlQbits, qbitsApplied, inputs, modifiers) {
        // about modifiers:
        // if there is only 1 or 0 unitaries, we can still apply float powers to this gate by collecting the powers and applying them to all components
        // else, remove all power and inverse modifiers and apply this gate multiple times or flip is components accordingly
        // pool together all controls and pass them down to the components as modifiers
        let totalPower = 1
        let passedDownControls = []
        for (let i = 0; i < modifiers.length; i++) {
            const type = modifiers[i].type
            if (type == "inverse") { totalPower *= -1 }
            else if (type == "power") { totalPower *= modifiers[i].value }
            else if (type == "control" || type == "negativeControl") { passedDownControls.push(modifiers[i]) }
        }


        let passedDownPower = undefined

        // if this gate has only one or zero unitaries, we can still apply float powers
        let numUnitaries = 0
        const c = this.components
        for (let i = 0; i < c.length; i++) {
            // if this gate contains another which has more than one unitary, it will be missed for now, but that gate itself will catch it
            numUnitaries += c[i].effect.constructor.type == "Unitary" ? 1 : 0
        }

        if (numUnitaries > 1) {
            if (totalPower !== Math.floor(totalPower)) {
                // if it's a float power, log an error
                console.log("ERROR: tried applying a float-valued power to a gate with more than one unitary: " + totalPower, this)
            }
        }
        else { //we can actually apply the float power, by passing down the power modifier
            passedDownPower = new Modifier("power", totalPower)
            totalPower = 1
        }
        // so it will only apply the int power through repetition if there are more than 1 unitaries


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


        // we repeat application of all components according to the power this gate was raised to (if it's an int power)
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
                if (passedDownPower) {cModifiers.push(passedDownPower)}


                // getting all the inputs to this component and then applying it to the state

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

                await state.apply(c, thisControlQbits, thisQbitsApplied, thisInputs, cModifiers)
            }

        }
    }
}