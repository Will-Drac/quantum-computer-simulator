class Gate{
    constructor() {
        this.components = []
    }

    addComponent(component) {
        // a component is either a Unitary or another Gate
        this.components.push(component)
    }
}