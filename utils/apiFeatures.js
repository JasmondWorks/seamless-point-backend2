class APIFEATURES {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
    this.baseFilter = {};
    this.appliedFilter = null;
    this.pagination = { page: 1, limit: 100, skip: 0 };
  }

  filter(filterObj = {}) {
    this.baseFilter = { ...filterObj };
    const filter = this._buildFilter();
    this.appliedFilter = filter;
    this.query = this.query.find(filter);
    return this;
  }

  _buildFilter(extraFilter = {}) {
    const queryObj = {
      ...this.queryString,
      ...(this.baseFilter || {}),
      ...extraFilter,
    };
    const excludedFields = ["page", "sort", "limit", "fields"];

    excludedFields.forEach((el) => delete queryObj[el]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    return JSON.parse(queryStr);
  }

  getFilter(additionalFilter = {}) {
    if (
      Object.keys(additionalFilter).length === 0 &&
      this.appliedFilter !== null
    ) {
      return this.appliedFilter;
    }

    return this._buildFilter(additionalFilter);
  }

  limitFields() {
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
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort({ createdAt: -1 });
    }
    return this;
  }

  paginate() {
    const parsedPage = Number.parseInt(this.queryString.page, 10);
    const parsedLimit = Number.parseInt(this.queryString.limit, 10);

    const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const limit =
      Number.isNaN(parsedLimit) || parsedLimit < 1 ? 100 : parsedLimit;

    const skip = (page - 1) * limit;
    this.query = this.query.skip(skip).limit(limit);
    this.pagination = { page, limit, skip };

    return this;
  }
}

module.exports = APIFEATURES;
