-- Geardrak source images can exceed the original 5 MiB object limit.
update storage.buckets set file_size_limit = 31457280 where id = 'hunting-images';
