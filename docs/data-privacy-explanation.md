# How Auro Protects Your Data (and Your Clients)

At Auro, we believe AI should be a vault, not a megaphone. Our architecture is built from the ground up to ensure that **Provident's data belongs only to Provident**.

Here is exactly how our technology secures your proprietary information:

## 1. The "Tenant Isolation" Promise
Think of Auro like a secure office building. While many companies work in the building (the Auro platform), your office (Tenant ID: 1) is locked with your own unique key.

*   **Strict Segregation:** Every single piece of data—from a PDF brochure to a WhatsApp chat log—is stamped with your unique `tenant_id`.
*   **The "Internal Truth" Engine:** When we ingest your documents (like payment plans or floor plans), we convert them into mathematical vectors. These vectors are stored in a partition that **only your specific agent** can access.
*   **No Cross-Talk:** If another agency asks their Auro agent about "Passo Payment Plans," it will say "I don't know," because it cannot see your private documents. It physically cannot read your vectors.

## 2. How the AI "Reads" Your Documents
We do not simply upload your PDFs to a public AI model. We use a secure process called **RAG (Retrieval-Augmented Generation)**:

1.  **Extraction:** We extract the text from your documents once, securely on our servers.
2.  **Vectorization:** We convert that text into "meaning coordinates" (vectors) and store them in our isolated database.
3.  **On-Demand Access:** When a client asks a question, the AI searches your private vault for the exact paragraph that contains the answer.
4.  **Ephemeral Processing:** It sends *only that specific paragraph* to the AI model to generate a natural response, and then discards it. The AI model **does not train** on your data.

## 3. Your Data vs. Public Data
Your agent balances two sources of intelligence, but **always prioritizes you**:

*   **Primary Source (Internal Truth):** Your uploaded brochures, SOPs, and market reports. The AI treats this as the absolute authority.
*   **Secondary Source (Public Web):** If (and only if) your internal documents don't have the answer, the AI can search the public web for general market news. It will never share your private data with the web.

## 4. Security by Default
*   **Encryption:** All data is encrypted at rest (in the database) and in transit (while moving to the AI).
*   **Access Control:** Only authorized Provident admins can view or manage the Knowledge Base.
*   **Audit Logging:** Every time the AI accesses a document to answer a question, we log exactly what was retrieved and why.

---
*Auro is designed to be the guardian of your intellectual property, turning your proprietary knowledge into your competitive advantage.*
