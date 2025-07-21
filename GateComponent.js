class GateComponent {
    constructor(effect, modifiers) {
        this.effect = effect //effect is a Gate or GPhase or Unitary
        this.modifiers = modifiers
    }

    getNumControls() {
        let controls = 0
        for (let i = 0; i < this.modifiers.length; i++) {
            if (this.modifiers[i].type == "control" || this.modifiers[i].type == "negativeControl") {
                controls++
            }
        }
        if (this.effect.constructor.name == "Gate") {
            controls += this.effect.numControls
        }

        return controls
    }
}