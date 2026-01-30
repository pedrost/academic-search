import { Card, CardBody, Skeleton } from '@nextui-org/react'

export function SkeletonCard() {
  return (
    <Card className="w-full">
      <CardBody className="gap-3">
        <div className="flex gap-3">
          <Skeleton className="rounded-full w-12 h-12" />
          <div className="flex flex-col gap-2 flex-1">
            <Skeleton className="h-4 w-3/4 rounded-lg" />
            <Skeleton className="h-3 w-1/2 rounded-lg" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
        <div className="flex justify-between">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </CardBody>
    </Card>
  )
}
