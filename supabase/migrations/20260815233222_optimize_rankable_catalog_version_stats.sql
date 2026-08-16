-- Reserved migration version applied to production while profiling the catalog
-- reader. The finalized function and supporting index follow in the next
-- migration so fresh databases and production converge on the same state.
select 1;
