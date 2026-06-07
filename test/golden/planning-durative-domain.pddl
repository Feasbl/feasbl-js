(define (domain courier)
  (:requirements :strips :typing :durative-actions :numeric-fluents)
  (:types location vehicle)
  (:predicates
    (at ?x1 - vehicle ?x2 - location)
    (road ?x1 - location ?x2 - location)
  )
  (:functions
    (battery ?x1 - vehicle)
    (distance ?x1 - location ?x2 - location)
  )

  (:durative-action drive
    :parameters (?truck - vehicle ?start - location ?end - location)
    :duration (= ?duration (distance ?start ?end))
    :condition
      (and
        (at start (at ?truck ?start))
        (at start (road ?start ?end))
        (at start (>= (battery ?truck) (distance ?start ?end)))
        (over all (road ?start ?end))
      )
    :effect
      (and
        (at start (not (at ?truck ?start)))
        (at end (at ?truck ?end))
        (at end (decrease (battery ?truck) (distance ?start ?end)))
      )
  )
)
