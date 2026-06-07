(define (problem courier_problem)
  (:domain courier)
  (:objects
    van - vehicle
    depot customer - location
  )
  (:init
    (at van depot)
    (road depot customer)
    (= (battery van) 100)
    (= (distance depot customer) 10)
  )
  (:goal
    (at van customer)
  )
)
