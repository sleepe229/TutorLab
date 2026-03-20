package project.TutorLab.service.impl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import project.TutorLab.config.JwtService;
import project.TutorLab.dto.TutorLoginDto;
import project.TutorLab.dto.TutorRegistrationDto;
import project.TutorLab.dto.TutorResponseDto;
import project.TutorLab.dto.TutorUpdateDto;
import project.TutorLab.model.Tutor;
import project.TutorLab.repository.TutorRepository;
import project.TutorLab.service.IndexNowService;
import project.TutorLab.service.TutorService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class TutorServiceImpl implements TutorService {

    private static final Logger log = LoggerFactory.getLogger(TutorServiceImpl.class);

    @Autowired
    private TutorRepository tutorRepository;

    @Autowired
    private BCryptPasswordEncoder passwordEncoder;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private IndexNowService indexNowService;

    @Value("${app.jwt.refresh-ttl-days:30}")
    private long refreshTtlDays;

    @Override
    public TutorResponseDto registerTutor(TutorRegistrationDto registrationDto) {
        if (tutorRepository.existsByLogin(registrationDto.getLogin())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Пользователь с таким логином уже существует");
        }

        String tutorId = UUID.randomUUID().toString();

        Tutor tutor = new Tutor();
        tutor.setId(tutorId);
        tutor.setFullName(registrationDto.getFullName());
        tutor.setLogin(registrationDto.getLogin());
        tutor.setPassword(passwordEncoder.encode(registrationDto.getPassword()));
        tutor.setStudentIds(new ArrayList<>());

        tutorRepository.save(tutor);
        log.info("Registered new tutor: login={}, id={}", registrationDto.getLogin(), tutorId);

        return buildLoginResponse(tutor);
    }

    @Override
    public TutorResponseDto loginTutor(TutorLoginDto loginDto) {
        Tutor tutor = tutorRepository.findByLogin(loginDto.getLogin());
        if (tutor == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Неверный логин или пароль");
        }
        if (!passwordEncoder.matches(loginDto.getPassword(), tutor.getPassword())) {
            log.warn("Failed login attempt for login={}", loginDto.getLogin());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Неверный логин или пароль");
        }
        log.info("Tutor logged in: login={}, id={}", loginDto.getLogin(), tutor.getId());
        return buildLoginResponse(tutor);
    }

    @Override
    public TutorResponseDto updateTutor(String id, TutorUpdateDto updateDto) {
        Tutor tutor = tutorRepository.findById(id);
        if (tutor == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Репетитор не найден");
        }

        if (updateDto.getFullName() != null) {
            tutor.setFullName(updateDto.getFullName());
        }
        if (updateDto.getPhotoUrl() != null) {
            tutor.setPhotoUrl(updateDto.getPhotoUrl());
        }
        if (updateDto.getAbout() != null) {
            tutor.setAbout(updateDto.getAbout());
        }
        if (updateDto.getSubjects() != null) {
            tutor.setSubjects(updateDto.getSubjects());
        }
        if (updateDto.getHourlyRate() != null) {
            tutor.setHourlyRate(updateDto.getHourlyRate());
        }
        boolean wasPublic = tutor.isPublicProfile();
        if (updateDto.getIsPublicProfile() != null) {
            tutor.setPublicProfile(updateDto.getIsPublicProfile());
        }

        tutorRepository.save(tutor);

        // Notify Bing/Yandex when a tutor first makes their profile public
        if (!wasPublic && tutor.isPublicProfile()) {
            indexNowService.submitUrl("https://tutorlab.onrender.com/tutors");
        }

        return convertToResponseDto(tutor);
    }

    @Override
    public boolean loginExists(String login) {
        return tutorRepository.existsByLogin(login);
    }

    @Override
    public TutorResponseDto getTutorById(String id) {
        Tutor tutor = tutorRepository.findById(id);
        if (tutor == null) {
            return null;
        }
        return convertToResponseDto(tutor);
    }

    @Override
    public boolean tutorExists(String id) {
        return tutorRepository.existsById(id);
    }

    @Override
    public List<TutorResponseDto> getPublicTutors() {
        return tutorRepository.findAllPublic().stream()
                .map(this::convertToResponseDto)
                .collect(Collectors.toList());
    }

    private TutorResponseDto convertToResponseDto(Tutor tutor) {
        TutorResponseDto dto = new TutorResponseDto();
        dto.setId(tutor.getId());
        dto.setFullName(tutor.getFullName());
        dto.setLogin(tutor.getLogin());
        dto.setPhotoUrl(tutor.getPhotoUrl());
        dto.setAbout(tutor.getAbout());
        dto.setStudentIds(tutor.getStudentIds());
        dto.setSubjects(tutor.getSubjects());
        dto.setHourlyRate(tutor.getHourlyRate());
        dto.setPublicProfile(tutor.isPublicProfile());
        return dto;
    }

    private TutorResponseDto buildLoginResponse(Tutor tutor) {
        // Short-lived JWT access token
        String accessToken = jwtService.generateAccessToken(tutor.getId());

        // Long-lived refresh token (opaque UUID, stored in Redis)
        String refreshToken = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set("refresh:" + refreshToken, tutor.getId(), refreshTtlDays, TimeUnit.DAYS);

        TutorResponseDto dto = convertToResponseDto(tutor);
        dto.setSessionToken(accessToken);   // kept for frontend backward compatibility
        dto.setRefreshToken(refreshToken);
        return dto;
    }
}