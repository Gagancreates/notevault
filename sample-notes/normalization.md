# Normalization (DBMS Unit 3)

Normalization is the process of organising the columns and tables of a relational database to reduce data redundancy and improve data integrity. Redundant data wastes storage and creates update, insertion and deletion anomalies.

## First Normal Form (1NF)
A relation is in 1NF when every attribute holds atomic values and there are no repeating groups. A column like "phone_numbers" holding a comma-separated list violates 1NF.

## Second Normal Form (2NF)
A relation is in 2NF when it is in 1NF and every non-key attribute is fully functionally dependent on the whole primary key. Partial dependencies on part of a composite key must be removed by splitting the table.

## Third Normal Form (3NF)
A relation is in 3NF when it is in 2NF and no non-key attribute is transitively dependent on the primary key. If A determines B and B determines C, then C should move to its own table.

## Boyce–Codd Normal Form (BCNF)
BCNF is a stricter version of 3NF: for every non-trivial functional dependency X → Y, X must be a superkey. Decomposition into BCNF is always lossless but may not preserve all dependencies.
