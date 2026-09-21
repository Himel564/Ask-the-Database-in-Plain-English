# LinguaSQL

> **Cognizant NPN Hackathon 2026 — Use Case 9**  
> **Live Demo:** [http://13.206.248.246](http://13.206.248.246)

Ask your database anything in plain English or voice in your spoken language. LinguaSQL translates natural language queries into validated, secure SQL, executes them on PostgreSQL, and presents auto-generated charts, structured data tables, and natural language summaries.

---

## 👥 Team Members

* Himel Biswas
* Ardina Banerjee
* Sudeshna Paul[cite: 1]
* Krishna Kanta Rana[cite: 1]
* Masud Mallik[cite: 1]
* SK Shahanul Haque[cite: 1]

---

## ✨ Key Features

* **Multilingual Querying:** Query data using text or speech in English, Hindi, or Bengali[cite: 1].
* **Voice Capabilities:** Integrated with Groq Whisper for speech recognition and gTTS for spoken responses[cite: 1].
* **Two-Layer Security:** SQL Guard validation coupled with a read-only PostgreSQL database user[cite: 1].
* **Smart Visualization:** Automated chart selection verified by programmatic rules[cite: 1].
* **Multi-Format Ingestion:** Query live PostgreSQL databases or upload `.xlsx`, `.csv`, and `.pdf` files[cite: 1].
* **Export Options:** Download results, SQL queries, and generated charts directly as PDF or Excel files[cite: 1].
* **Built-in Evaluation:** Automated benchmarking module to test SQL accuracy against expected outputs[cite: 1].

---

## 🏗 System Architecture

The pipeline processes user questions through natural language translation, security validation, query execution, and visual rendering[cite: 1]:

![LinguaSQL Architecture](images/archietecture.png)

---

## 🗄 Database EER Diagram

The database models relational dependencies across employee hierarchies, departments, compensation, and history[cite: 1]:

![LinguaSQL Database Schema](images/db.png)

---

## ☁️ Cloud Infrastructure

Deployed on AWS (`ap-south-1` region) with isolation between public application tiers and private database services[cite: 1]:

* **Compute:** Amazon ECS on EC2 `t3.small` running Nginx frontend & FastAPI backend[cite: 1].
* **Container Registry:** Amazon ECR[cite: 1].
* **Database:** Amazon RDS (PostgreSQL) isolated in private subnets[cite: 1].
* **Secrets:** AWS SSM Parameter Store[cite: 1].

---

## 🚀 Getting Started

### Prerequisites
* Docker & Docker Compose

### Quickstart with Docker Compose

Run the entire application stack locally with a single command[cite: 1]:

```bash
# Clone repository
git clone [https://github.com/student-Sudeshnapaul/Ask-the-Database-in-Plain-English.git](https://github.com/student-Sudeshnapaul/Ask-the-Database-in-Plain-English.git)
cd Ask-the-Database-in-Plain-English

# Start services
docker-compose up --build -d
