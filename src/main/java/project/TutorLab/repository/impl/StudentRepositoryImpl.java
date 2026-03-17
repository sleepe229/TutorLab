package project.TutorLab.repository.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;
import project.TutorLab.model.Student;
import project.TutorLab.repository.StudentRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Repository
public class StudentRepositoryImpl implements StudentRepository {

    private static final String STUDENT_KEY_PREFIX = "student:";
    private static final String TUTOR_STUDENTS_KEY_PREFIX = "tutor:students:";

    @Value("${app.student.ttl-days:30}")
    private long ttlDays;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Override
    public Student save(Student student) {
        String key = STUDENT_KEY_PREFIX + student.getId();
        redisTemplate.opsForValue().set(key, student, ttlDays, TimeUnit.DAYS);
        
        String tutorStudentsKey = TUTOR_STUDENTS_KEY_PREFIX + student.getTutorId();
        redisTemplate.opsForSet().add(tutorStudentsKey, student.getId());
        redisTemplate.expire(tutorStudentsKey, ttlDays, TimeUnit.DAYS);
        
        return student;
    }

    @Override
    public Student findById(String id) {
        String key = STUDENT_KEY_PREFIX + id;
        Object value = redisTemplate.opsForValue().get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof Student) {
            return (Student) value;
        }
        try {
            return objectMapper.convertValue(value, Student.class);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public List<Student> findByTutorId(String tutorId) {
        String tutorStudentsKey = TUTOR_STUDENTS_KEY_PREFIX + tutorId;
        Set<Object> studentIds = redisTemplate.opsForSet().members(tutorStudentsKey);
        
        if (studentIds == null || studentIds.isEmpty()) {
            return new ArrayList<>();
        }
        
        List<Student> students = new ArrayList<>();
        for (Object studentIdObj : studentIds) {
            String studentId = studentIdObj.toString();
            Student student = findById(studentId);
            if (student != null) {
                students.add(student);
            }
        }
        return students;
    }

    @Override
    public void deleteById(String id) {
        Student student = findById(id);
        if (student != null) {
            String key = STUDENT_KEY_PREFIX + id;
            redisTemplate.delete(key);
            
            String tutorStudentsKey = TUTOR_STUDENTS_KEY_PREFIX + student.getTutorId();
            redisTemplate.opsForSet().remove(tutorStudentsKey, id);
        }
    }

    @Override
    public boolean existsById(String id) {
        String key = STUDENT_KEY_PREFIX + id;
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }
}

