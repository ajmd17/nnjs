class Field {
  constructor(type) {

  }

  categorical() {
    return this.type == Field.Type.CATEGORICAL;
  }
  
  numerical() {
    return this.type == Field.Type.NUMERICAL;
  }
}

Field.Type = {
  CATEGORICAL: 'C',
  NUMERICAL: 'N'
};

class CategoricalField extends Field {
  /** @param {string} value */
  constructor(value) {
    super(Field.Type.CATEGORICAL);

    this.value = value;
  }
}


// schema style
[
  {
    label: 'a',
    datatype: Field.Type.NUMERICAL
  },
  {
    label: 'a',
    datatype: Field.Type.NUMERICAL
  },
]

