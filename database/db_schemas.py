database_schema="""
Table: department(
    id                  INTEGER PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    location            VARCHAR(100),
    head_of_department  INTEGER
)

Table: employee(
    id          INTEGER PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    hire_date   DATE NOT NULL,
    manager_id  INTEGER REFERENCES employee(id),
    dept_id     INTEGER REFERENCES department(id)
)

Table: salary(
    id              INTEGER PRIMARY KEY,
    employee_id     INTEGER REFERENCES employee(id),
    amount          NUMERIC(12,2) NOT NULL,
    effective_from  DATE NOT NULL
)

Table: address(
    id          INTEGER PRIMARY KEY,
    employee_id INTEGER REFERENCES employee(id),
    city        VARCHAR(100),
    state       VARCHAR(100),
    pin_code    VARCHAR(20)
)

Table: job_history(
    id          INTEGER PRIMARY KEY,
    employee_id INTEGER REFERENCES employee(id),
    old_role    VARCHAR(100),
    new_role    VARCHAR(100),
    changed_on  DATE
)

Table: dept_assignment(
    id                  INTEGER PRIMARY KEY,
    employee_id         INTEGER REFERENCES employee(id),
    dept_id             INTEGER REFERENCES department(id),
    allocation_percent  INTEGER
)
"""