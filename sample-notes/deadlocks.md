# Deadlocks (Operating Systems Unit 2)

A deadlock is a situation where a set of processes are blocked because each process is holding a resource and waiting for another resource held by some other process.

Four conditions must hold simultaneously for a deadlock: mutual exclusion, hold and wait, no preemption, and circular wait.

Deadlock prevention removes one of the four conditions, for example by ordering resources so circular wait cannot occur. Deadlock avoidance uses the Banker's algorithm to grant a request only if the system stays in a safe state.

Deadlock detection builds a wait-for graph and looks for cycles; recovery then aborts a victim process or preempts its resources. Databases use the same idea: when two transactions wait on each other's locks, the DBMS detects the cycle and rolls one of them back.
