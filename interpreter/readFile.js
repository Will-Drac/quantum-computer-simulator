const defaultVariables = {
    π: { value: Math.PI, type: "float", const: true },
    τ: { value: 2 * Math.PI, type: "float", const: true },
    e: { value: Math.E, type: "float", const: true },

    pi: { value: Math.PI, type: "float", const: true },
    tau: { value: 2 * Math.PI, type: "float", const: true },
    euler: { value: Math.E, type: "float", const: true }
}

let state, variables

async function parseQasm(text) {
    const bigCommentsRemoved = text.replace(/\/\*[\s\S]*?\*\//g, '')
    const commentsRemoved = bigCommentsRemoved.replace(/\/\/.*?\n/g, '')
    const whiteSpaceCollapsed = commentsRemoved.replace(/\s+/g, ' ').trim()

    let lines = whiteSpaceCollapsed
        .split(/(?<=[{}])|;/)   // split after { and }, or on ;
        .map(s => s.trim())     // remove leading/trailing whitespace
        .filter(s => s.length) // remove empty strings

    lines = lines.filter(str => str !== "")

    // checking if the first line is the right version of OPENQASM
    if (lines[0].includes("OPENQASM") && !lines[0].includes("OPENQASM 3.")) {
        alert("OpenQasm Version not Supported")
        return
    }
    else {
        lines = lines.splice(1) //removing the version definition
    }

    // splitting lines by spaces and separating out the brackets
    for (let i = 0; i < lines.length; i++) {
        lines[i] = lines[i].split(" ")

        lines[i] = lines[i].flatMap(part =>
            part.match(/[^\[\]\(\)\{\}\+\-\*\/,\s]+|[\[\]\(\)\{\}\+\-\*\/,]/g)
        )
    }

    // starting up the state that will hold all the qbits
    state = new State(0)

    // resetting the variables by deep copying the defaults
    variables = JSON.parse(JSON.stringify(defaultVariables))

    for (let i = 0; i < lines.length; i++) {
        const l = lines[i]

        switch (l[0]) {
            case "qbit":
                parseQbitDeclaration(l)
                break

            case "const":
                parseClassicalDeclaration(l.splice(1), true) //removing the const
                break

            case "float": case "int": case "uint": case "bit": case "complex": case "angle":
                parseClassicalDeclaration(l, false)
                break

            case "include":
                const url = l.splice(1)[0].replace(/['"`]/g, '')
                const resp = await fetch(url)
                const includedCode = await resp.text()
                await parseQasm(includedCode)

            case "U":
                await parseUnitaryApplication(l.splice(2))
        }
    }
}

// !should return the type of the number coming out (and actually determine that type)
// expression is an array of terms
function evaluateMath(expression) {
    // first, replace all terms which can be replaced
    for (let i = 0; i < expression.length; i++) {
        if (variables[expression[i]] !== undefined) { expression[i] = variables[expression[i]].value }
    }

    let math = ""
    for (let i = 0; i < expression.length; i++) {
        math += expression[i] + " "
    }

    return eval(math)
}

function parseQbitDeclaration(line) {
    if (line[1] == "[") { //this will be a register
        let mathExpression = []
        let i = 2
        while (line[i] !== "]") {
            mathExpression.push(line[i])
            i++
        }
        const qbitsToAdd = evaluateMath(mathExpression)

        let qbitIndices = []
        for (let i = 0; i < qbitsToAdd; i++) {
            qbitIndices.push(state.numQbits + i)
        }

        variables[line[line.length - 1]] = { type: "qReg", globalQbitIndices: qbitIndices }

        state.addQbits(qbitsToAdd)
    }
    else { //it's just a single qbit definition
        variables[line[1]] = { type: "qbit", globalQbitIndex: state.numQbits }

        state.addQbits(1)
    }
}

// ! declaring variables with a specific number of bits
function parseClassicalDeclaration(line, isConst) {
    const type = line[0]

    // !specifying the number of bits

    const name = line[1] //when we declare the number of bits it wont be at index 1
    const redeclaringConstant = variables[name] !== undefined ? variables[name].const : false
    if (redeclaringConstant) { console.log("error: redeclaring constant " + name); return }

    switch (type) {
        case "float":

        case "int":

        case "uint":
            parseUintDeclaration(line.splice(1), isConst) //removing the "uint"

        case "bit":

        case "complex":

        case "angle":
    }
}

function parseUintDeclaration(line, isConst) {
    variables[line[0]] = { value: evaluateMath(line.splice(2)), type: "uint", const: isConst } //removing the variable name and the "=" from the line
}

async function parseUnitaryApplication(line) {
    // collecting each input separately in an array
    let inputs = [[], [], []]
    let j = 0
    for (let i = 0; i < 3; i++) {
        while (line[j] !== "," && line[j] !== ")") {
            if (line[j] == ")") { break }
            inputs[i].push(line[j])
            j++
        }
        j++
    }

    // turning the inputs into numerical values
    for (let i = 0; i < 3; i++) {
        inputs[i] = evaluateMath(inputs[i])
    }

    const unitaryGate = new Unitary(inputs[0], inputs[1], inputs[2])

    line = line.splice(j) //removing everything except the qbit(s) being affected

    const qVariable = variables[line[0]]

    if (qVariable.type == "qbit") {
        await state.apply(unitaryGate, [], [qVariable.globalQbitIndex], [], [])
    }

    else if (qVariable.type == "qReg") {
        if (line[1] == "[") { //we're selecting one target from the register
            let i = 2
            let indexExpression = []
            while (line[i] !== "]") {
                indexExpression.push(line[i])
                i++
            }

            const registerIndex = evaluateMath(indexExpression)

            await state.apply(unitaryGate, [], [qVariable.globalQbitIndices[registerIndex]], [], [])
        }

        else { //we're applying to the whole register
            for (let qbit of qVariable.globalQbitIndices) {
                await state.apply(unitaryGate, [], [qbit], [], [])
            }
        }
    }
}