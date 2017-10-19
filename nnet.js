
class InputData {
    /**
     * 
     * @param {{[key: string]: string}} schema 
     * @param {any[][]} values 
     */
    constructor(schema, values) {
        this.schema = schema;
        this.values = values;
    }
}

/**
 * @param {any[][]} rows
 */
InputData.from = function (rows) {
    if (rows.length == 0) {
        throw Error('Empty rows provided.');
    }

    const row0Schema = getRowSchema(rows[0]);

    return new InputData(row0Schema, rows);
};

class TrainedData {
    /**
     * 
     * @param {number[]} vWeights 
     * @param {number[][]} wWeights 
     */
    constructor(vWeights, wWeights) {
        this.vWeights = vWeights;
        this.wWeights = wWeights;
    }

    /**
     * Creates a new TrainedData object with the average of this and other
     * @param {TrainedData} other 
     */
    merge(other) {
        if (this.vWeights.length != other.vWeights.length) {
            throw Error('vWeights must have same size');
        }

        let newVWeights = this.vWeights.map((x, i) => (x + other.vWeights[i]) / 2);

        if (this.vWeights.length != other.wWeights.length) {
            throw Error('wWeights must have same size');
        }

        let newWWeights = this.wWeights.map((x, i) => {
            if (x.length != other.wWeights[i].length) {
                throw Error(`wWeights${i} must have same size as other.wWeights${i}`);
            }

            return x.map((y, j) => {
                return (y + other.wWeights[i][j]) / 2;
            });
        });

        return new TrainedData(newVWeights, newWWeights);
    }
}


class NeuralNetwork {
    /**
     * @param {InputData} inputData
     * @param {any[][]} outputData
    */
    constructor(inputData, outputData) {
        this.inputData = inputData;
        this.outputData = outputData;

        this._dimension = inputData.values[0].length;

        /** @type {TrainedData} */
        this.trainedData = null;
    }

    train() {
        
    }

    predict(inputs) {

    }
}

class ColumnPicker {
    /** @param {number} numColumns */
    constructor(numColumns) {
        this.numColumns = numColumns;
        this._dataset = new Set();
        this._exclude = [];
    }

    values() {
        return [...this._dataset].filter(x => this._exclude.indexOf(x) === -1);
    }

    /**
     * Add specific columns to the dataset
     * @param {...number} colsToKeep
     */
    pick(...colsToKeep) {
        for (let i = 0; i < colsToKeep.length; i++) {
            if (colsToKeep[i] < 0 || colsToKeep[i] >= this.numColumns) {
                throw Error(`${colsToKeep[i]} is out of range of number of columns (${this.numColumns})`);
            }

            this._dataset.add(colsToKeep[i]);
        }

        return this;
    }

    /**
     * Remove specific columns from the dataset
     * @param {...number} colsToRemove
     */
    exclude(...colsToRemove) {
        Array.prototype.push.apply(this._exclude, colsToRemove);
        return this;
    }

    /**
     * Add a range of columns to the dataset
     * @param {number} start 
     * @param {number} end 
     */
    range(start, end) {
        const sign = Math.sign(end - start);

        if (sign == 1) {
            for (let i = start; i < end; i += 1) {
                this._dataset.add(i);
            }
        } else if (sign == -1) {
            for (let i = start; i > end; i -= 1) {
                this._dataset.add(i);
            }
        } else if (sign == 0) {
            this._dataset.add(start);
        }

        return this;
    }
}

const DataTypes = {
    INTEGER: 'integer',
    FLOAT: 'float',
    STRING: 'string'
};

/**
 * @param {string} str 
 */
function getDataType(str) {
    if (!isNaN(str)) {
        if (str.indexOf('.') !== -1) {
            return DataTypes.FLOAT;
        }
        
        return DataTypes.INTEGER;
    } else {
        return DataTypes.STRING;
    }
}

/**
 * @param {string[]} row 
 */
function getRowSchema(row) {
    return row.map(getDataType);
}

NeuralNetwork.Builder = {
    /** @param {string} csv */
    fromCsv: (csv) => {
        let split = csv.split('\n')
            .map(x => x.trim())
            .filter(x => x.length != 0);

        if (split.length == 0) {
            throw Error('No input rows');
        }

        split = split.map(row => row.split(','));

        const numRows = split.length;
        const numColumns = split[0].length;

        const inputColumnPicker = new ColumnPicker(numColumns);
        const outputColumnPicker = new ColumnPicker(numColumns);

        return {
            hasHeader: true,
            inputs: inputColumnPicker,
            outputs: outputColumnPicker,

            header: function (enabled=true) {
                this.hasHeader = enabled;
            },

            build: function () {
                const inputColumnIndices = inputColumnPicker.values();
                const outputColumnIndices = outputColumnPicker.values();

                const inputData = [];
                const outputData = [];

                split.forEach((row, rowIdx) => {
                    if (this.hasHeader && rowIdx == 0) {
                        return;
                    }

                    let inputArr = [];
                    let outputArr = [];

                    for (let i = 0; i < row.length; i++) {
                        if (inputColumnIndices.indexOf(i) !== -1) {
                            inputArr.push(row[i]);
                        }
                        
                        if (outputColumnIndices.indexOf(i) !== -1) {
                            outputArr.push(row[i]);
                        }
                    }

                    inputData.push(inputArr);
                    outputData.push(outputArr);
                });
                
                return new NeuralNetwork(InputData.from(inputData), outputData);
            }
        };
    }
};

let builder = NeuralNetwork.Builder.fromCsv(`
    i1,i2,i3,o1,o2
    1.3,9.4,2.3,Out1,Out2
`);

builder.header(true);
builder.inputs.range(0, 3);
builder.outputs.range(3, 5);

let nn = builder.build();
console.log('nn = ', nn);