import * as feasbl from "@feasbl/sdk";

const cp = feasbl.cp("assignment");

const alice = cp.integer("alice", { values: [0, 1, 2] });
const bob = cp.integer("bob", { values: [0, 1, 2] });
const chandra = cp.integer("chandra", { values: [0, 1, 2] });

const assignedTasks = cp.integerSet("assignedTasks", [alice, bob, chandra]);

cp.allDifferent("one-task-each", assignedTasks);
cp.constraint("alice-not-task-2", cp.ne(alice, 2));
cp.constraint("bob-not-task-0", cp.ne(bob, 0));

cp.satisfy();

console.log(cp.toJia());

