class APIFEATURES {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter(filterObj) {
    const queryObj = { ...this.queryString, ...filterObj };
    console.log(queryObj);
    const excludedFields = ["page", "sort", "limit", "fields"];

    excludedFields.forEach((el) => delete queryObj[el]);

    // 2) Advanced filtering
    let queryStr = JSON.stringify(queryObj);

    // `{price: $gt: 4}`;
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  // 3) Field Limiting
  limitFields() {
    console.log(this.queryString);
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(",").join(" ");
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select("-__v");
    }

    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      ["price rat "];
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort({ created_at: -1 });
    }
    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;
    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

module.exports = APIFEATURES;
