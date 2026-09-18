import psycopg2
import os
from dotenv import load_dotenv
load_dotenv(r"database\.env")

import os

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "dbname": os.getenv("DB_NAME", "company_db"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgres"),
}

departments = [
    (1, "Engineering", "Bengaluru"),
    (2, "Human Resources", "Kolkata"),
    (3, "Finance", "Mumbai"),
    (4, "Sales", "Delhi"),
    (5, "Marketing", "Pune"),
    (6, "Operations", "Chennai"),
]

# (id, name, hire_date, manager_id, dept_id) - managers are inserted before their reports
employees = [
    (1, "Arjun Mehta", "2015-03-10", None, 1),
    (2, "Priya Sharma", "2016-07-01", None, 2),
    (3, "Rahul Verma", "2014-11-20", None, 3),
    (4, "Sneha Iyer", "2017-01-15", None, 4),
    (5, "Vikram Singh", "2018-05-22", None, 5),
    (6, "Ananya Das", "2019-02-11", 1, 1),
    (7, "Rohan Gupta", "2020-08-03", 1, 1),
    (8, "Kavya Nair", "2021-06-14", 6, 1),
    (9, "Aditya Rao", "2022-09-19", 6, 1),
    (10, "Meera Joshi", "2019-10-07", 2, 2),
    (11, "Sourav Banerjee", "2020-12-01", 3, 3),
    (12, "Pooja Reddy", "2021-03-25", 3, 3),
    (13, "Karan Malhotra", "2018-04-30", 4, 4),
    (14, "Neha Kapoor", "2022-01-10", 4, 4),
    (15, "Amit Chatterjee", "2023-07-17", 5, 5),

    # New employees
    (16, "Deepak Menon", "2019-06-03", None, 6),
    (17, "Ishita Bose", "2021-01-18", 1, 1),
    (18, "Manish Tiwari", "2022-05-09", 6, 1),
    (19, "Tanvi Kulkarni", "2023-02-13", 7, 1),
    (20, "Farhan Sheikh", "2020-09-21", 2, 2),
    (21, "Lakshmi Pillai", "2023-04-03", 10, 2),
    (22, "Nikhil Agarwal", "2019-08-12", 3, 3),
    (23, "Divya Saxena", "2022-10-24", 11, 3),
    (24, "Harsh Vardhan", "2021-11-08", 4, 4),
    (25, "Simran Kaur", "2023-01-16", 13, 4),
    (26, "Rekha Naidu", "2020-03-02", 5, 5),
    (27, "Yash Thakur", "2022-07-11", 26, 5),
    (28, "Tara Sen", "2020-01-20", 16, 6),
    (29, "Imran Qureshi", "2021-09-06", 16, 6),
    (30, "Bhavna Desai", "2023-08-21", 28, 6),
]

department_heads = [
    (1, 1),   # Arjun Mehta -> Engineering
    (2, 2),   # Priya Sharma -> Human Resources
    (3, 3),   # Rahul Verma -> Finance
    (4, 4),   # Sneha Iyer -> Sales
    (5, 5),   # Vikram Singh -> Marketing
    (16, 6),  # Deepak Menon -> Operations
]  # (employee_id, dept_id)

# (employee_id, amount, effective_from) - several employees have salary history
salaries = [
    (1, 180000, "2015-03-10"), (1, 250000, "2020-04-01"), (1, 320000, "2023-04-01"),
    (2, 150000, "2016-07-01"), (2, 210000, "2022-04-01"),
    (3, 170000, "2014-11-20"), (3, 280000, "2021-04-01"),
    (4, 160000, "2017-01-15"), (4, 230000, "2022-04-01"),
    (5, 140000, "2018-05-22"), (5, 200000, "2023-04-01"),
    (6, 90000, "2019-02-11"), (6, 150000, "2023-04-01"),
    (7, 85000, "2020-08-03"), (7, 120000, "2023-04-01"),
    (8, 70000, "2021-06-14"), (8, 95000, "2024-04-01"),
    (9, 65000, "2022-09-19"),
    (10, 75000, "2019-10-07"), (10, 95000, "2023-04-01"),
    (11, 80000, "2020-12-01"), (11, 110000, "2024-04-01"),
    (12, 72000, "2021-03-25"),
    (13, 88000, "2018-04-30"), (13, 120000, "2022-04-01"),
    (14, 60000, "2022-01-10"),
    (15, 55000, "2023-07-17"),

    # New employees
    (16, 130000, "2019-06-03"), (16, 175000, "2023-04-01"),
    (17, 78000, "2021-01-18"), (17, 105000, "2024-04-01"),
    (18, 68000, "2022-05-09"), (18, 82000, "2024-04-01"),
    (19, 62000, "2023-02-13"),
    (20, 72000, "2020-09-21"), (20, 98000, "2023-04-01"),
    (21, 58000, "2023-04-03"),
    (22, 92000, "2019-08-12"), (22, 130000, "2023-04-01"),
    (23, 66000, "2022-10-24"),
    (24, 75000, "2021-11-08"), (24, 99000, "2024-04-01"),
    (25, 58000, "2023-01-16"),
    (26, 95000, "2020-03-02"), (26, 135000, "2024-04-01"),
    (27, 64000, "2022-07-11"),
    (28, 85000, "2020-01-20"), (28, 115000, "2023-04-01"),
    (29, 70000, "2021-09-06"), (29, 88000, "2024-04-01"),
    (30, 52000, "2023-08-21"),

    # 2025 raises for existing employees
    (1, 380000, "2025-04-01"),
    (9, 78000, "2025-04-01"),
    (12, 90000, "2025-04-01"),
    (14, 75000, "2025-04-01"),
    (15, 68000, "2025-04-01"),
]

addresses = [
    (1, "Bengaluru", "Karnataka", "560001"),
    (2, "Kolkata", "West Bengal", "700001"),
    (3, "Mumbai", "Maharashtra", "400001"),
    (4, "New Delhi", "Delhi", "110001"),
    (5, "Pune", "Maharashtra", "411001"),
    (6, "Bengaluru", "Karnataka", "560034"),
    (7, "Hyderabad", "Telangana", "500001"),
    (8, "Kochi", "Kerala", "682001"),
    (9, "Bengaluru", "Karnataka", "560076"),
    (10, "Kolkata", "West Bengal", "700091"),
    (11, "Kolkata", "West Bengal", "700019"),
    (12, "Hyderabad", "Telangana", "500081"),
    (13, "Gurugram", "Haryana", "122001"),
    (14, "Noida", "Uttar Pradesh", "201301"),
    (15, "Mumbai", "Maharashtra", "400050"),

    # Second address for employee 1
    (1, "Chennai", "Tamil Nadu", "600001"),

    # New employees
    (16, "Chennai", "Tamil Nadu", "600028"),
    (17, "Bengaluru", "Karnataka", "560102"),
    (18, "Mysuru", "Karnataka", "570001"),
    (19, "Pune", "Maharashtra", "411045"),
    (20, "Kolkata", "West Bengal", "700054"),
    (21, "Thiruvananthapuram", "Kerala", "695001"),
    (22, "Mumbai", "Maharashtra", "400070"),
    (23, "Jaipur", "Rajasthan", "302001"),
    (24, "New Delhi", "Delhi", "110019"),
    (25, "Chandigarh", "Chandigarh", "160017"),
    (26, "Ahmedabad", "Gujarat", "380009"),
    (27, "Pune", "Maharashtra", "411014"),
    (28, "Chennai", "Tamil Nadu", "600042"),
    (29, "Hyderabad", "Telangana", "500034"),
    (30, "Coimbatore", "Tamil Nadu", "641001"),

    # Additional addresses
    (6, "Pune", "Maharashtra", "411057"),
    (13, "New Delhi", "Delhi", "110024"),
    (22, "Navi Mumbai", "Maharashtra", "400703"),
]
job_history = [
    (1, "Software Engineer", "Senior Engineer", "2018-04-01"),
    (1, "Senior Engineer", "Engineering Manager", "2020-04-01"),
    (1, "Engineering Manager", "Head of Engineering", "2023-04-01"),

    (2, "HR Executive", "HR Manager", "2019-04-01"),
    (2, "HR Manager", "Head of HR", "2022-04-01"),

    (3, "Accountant", "Finance Manager", "2018-04-01"),
    (3, "Finance Manager", "CFO", "2021-04-01"),

    (4, "Sales Executive", "Head of Sales", "2022-04-01"),

    (5, "Marketing Executive", "Head of Marketing", "2023-04-01"),

    (6, "Software Engineer", "Tech Lead", "2023-04-01"),
    (7, "Junior Engineer", "Software Engineer", "2023-04-01"),
    (8, "Intern", "Junior Engineer", "2022-06-14"),

    (10, "HR Intern", "HR Executive", "2020-10-07"),
    (11, "Junior Accountant", "Accountant", "2024-04-01"),
    (13, "Sales Associate", "Sales Executive", "2022-04-01"),

    # New employees
    (16, "Operations Executive", "Operations Manager", "2021-04-01"),
    (16, "Operations Manager", "Head of Operations", "2023-04-01"),

    (17, "Junior Engineer", "Software Engineer", "2023-04-01"),

    (18, "Intern", "Junior Engineer", "2023-05-09"),

    (20, "HR Executive", "Senior HR Executive", "2023-04-01"),

    (22, "Accountant", "Senior Accountant", "2022-04-01"),

    (24, "Sales Associate", "Sales Executive", "2023-04-01"),

    (26, "Marketing Executive", "Marketing Manager", "2023-04-01"),

    (28, "Operations Executive", "Operations Lead", "2022-04-01"),

    (29, "Operations Associate", "Operations Executive", "2023-04-01"),

    # 2025 promotions for existing employees
    (9, "Junior Engineer", "Software Engineer", "2025-04-01"),
    (12, "Accountant", "Senior Accountant", "2025-04-01"),
    (14, "Sales Associate", "Sales Executive", "2025-04-01"),
    (15, "Marketing Associate", "Marketing Executive", "2025-04-01"),
]

# (employee_id, dept_id, allocation_percent)
dept_assignments = [
    (1, 1, 100),
    (2, 2, 100),
    (3, 3, 100),
    (4, 4, 100),
    (5, 5, 100),

    (6, 1, 80), (6, 4, 20),
    (7, 1, 100),
    (8, 1, 60), (8, 5, 40),
    (9, 1, 100),
    (10, 2, 100),
    (11, 3, 50), (11, 4, 50),
    (12, 3, 100),
    (13, 4, 100),
    (14, 4, 70), (14, 5, 30),
    (15, 5, 100),

    # New employees
    (16, 6, 100),
    (17, 1, 100),
    (18, 1, 70), (18, 6, 30),
    (19, 1, 100),
    (20, 2, 100),
    (21, 2, 60), (21, 5, 40),
    (22, 3, 100),
    (23, 3, 100),
    (24, 4, 100),
    (25, 4, 50), (25, 5, 50),
    (26, 5, 100),
    (27, 5, 100),
    (28, 6, 100),
    (29, 6, 80), (29, 3, 20),
    (30, 6, 100),
]


def seed():
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                TRUNCATE dept_assignment, job_history, address, salary, employee, department
                RESTART IDENTITY CASCADE
            """)

            cur.executemany(
                "INSERT INTO department (id, name, location) VALUES (%s, %s, %s)",
                departments,
            )
            cur.executemany(
                "INSERT INTO employee (id, name, hire_date, manager_id, dept_id) VALUES (%s, %s, %s, %s, %s)",
                employees,
            )
            cur.executemany(
                "UPDATE department SET head_of_department = %s WHERE id = %s",
                department_heads,
            )
            cur.executemany(
                "INSERT INTO salary (employee_id, amount, effective_from) VALUES (%s, %s, %s)",
                salaries,
            )
            cur.executemany(
                "INSERT INTO address (employee_id, city, state, pin_code) VALUES (%s, %s, %s, %s)",
                addresses,
            )
            cur.executemany(
                "INSERT INTO job_history (employee_id, old_role, new_role, changed_on) VALUES (%s, %s, %s, %s)",
                job_history,
            )
            cur.executemany(
                "INSERT INTO dept_assignment (employee_id, dept_id, allocation_percent) VALUES (%s, %s, %s)",
                dept_assignments,
            )
        conn.commit()
        print("Sample data inserted successfully.")
    except Exception as e:
        conn.rollback()
        print("Error:", e)
    finally:
        conn.close()


if __name__ == "__main__":
    seed()